import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useCall } from '../contexts/CallContext';
import api from '../services/api';
import { reconciliationDelay } from '../utils/realtimePolicy';
import Header from '../components/Header';
import OnlineUsers from '../components/OnlineUsers';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import PastelIcon from '../components/PastelIcon';
import AIDebugModal from '../components/AIDebugModal';
import CharacterStudioModal from '../components/CharacterStudioModal';
import RefreshChatModal from '../components/RefreshChatModal';
import { useToast } from '../components/Toast';
import { useLang } from '../i18n';
import { getPastelColor, getPastelIdentity, PASTEL_IDENTITY_PALETTE } from '../utils/pastelIdentity';
import { loadPendingMessages, removePendingMessage, savePendingMessage } from '../utils/pendingMessages';
import {
  calculateHumanCompositionTime,
  calculateRemainingTypingDelay,
  calculateInterBubblePause,
  calculateReactionDelay
} from '../utils/aiTypingPacing';
import {
  TURN_STATE,
  TURN_CONFIG
} from '../utils/aiTurnTaking';
import { resolveCharacterAvatar, DEFAULT_LYRA_AVATAR } from '../utils/characterAvatar';
import { prepareLyraAvatarUpload } from '../utils/lyraAvatarMedia';
import {
  getCachedConversation,
  setCachedConversation,
  getCachedAvatar,
  mergeMessages
} from '../utils/conversationCache';

const isMobile = () => window.innerWidth <= 700;
const DELIVERY_RANK = { sending: 0, sent: 1, delivered: 2, read: 3, failed: -1 };

const Chat = () => {
  const { friendId } = useParams();
  const { user, updateProfile } = useAuth();
  const { socket, connected, relayMode, setLyraAvatar } = useSocket();
  const { startCall, activeCall } = useCall();
  const { push } = useToast();
  const { t } = useLang();
  const navigate = useNavigate();

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const activeSessionIdRef = useRef(null);
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);

  const initialCache = getCachedConversation(user?._id, friendId);
  const [messages, setMessages] = useState(() => initialCache?.messages || []);
  const [friend, setFriend] = useState(() => initialCache?.friend || (friendId === 'user_ai_lyra' ? {
    _id: 'user_ai_lyra',
    name: 'Lyra',
    isAI: true,
    isOnline: true,
    status: 'Online',
    avatar: getCachedAvatar(user?._id, 'user_ai_lyra') || DEFAULT_LYRA_AVATAR
  } : null));
  const [loading, setLoading] = useState(() => !initialCache?.messages?.length);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());
  const [chatColor, setChatColor] = useState(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [showAIDebug, setShowAIDebug] = useState(false);
  const [showCharacterStudio, setShowCharacterStudio] = useState(false);
  const [aiActivity, setAiActivity] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const typingRef = useRef({});
  const colorPickerRef = useRef(null);
  const deliveredAckRef = useRef(new Set());
  const readAckRef = useRef(new Set());
  const recoveredPendingRef = useRef(new Set());
  const pendingSendInFlightRef = useRef(new Set());
  const [aiTyping, setAiTyping] = useState(null);
  const conversationRevisionRef = useRef(0);
  const activeAiTurnRef = useRef(null);
  const reactionTimerRef = useRef(null);
  const deliveryTimerRef = useRef(null);
  const aiBubbleIdsInFlightRef = useRef(new Set());
  const deliverNextAiBubbleRef = useRef();
  const commitTurnGenerationRef = useRef();
  const friendRef = useRef(initialCache?.friend || null);

  useEffect(() => {
    friendRef.current = friend;
  }, [friend]);

  // Synchronize state when switching friends/conversations while Chat is mounted
  useEffect(() => {
    const cached = getCachedConversation(user?._id, friendId);
    if (cached?.messages && cached.messages.length > 0) {
      setMessages(cached.messages);
      setLoading(false);
    } else {
      setMessages([]);
      setLoading(true);
    }
    if (cached?.friend) {
      setFriend(cached.friend);
      friendRef.current = cached.friend;
    } else {
      setFriend(null);
      friendRef.current = null;
    }
  }, [friendId, user?._id]);

  // Human-like Turn-Taking refs
  const isUserTypingRef = useRef(false);
  const userTypingDebounceTimerRef = useRef(null);
  const userIdleTimerRef = useRef(null);
  const gracePeriodTimerRef = useRef(null);
  const microTurnTimerRef = useRef(null);

  const chatColorStorageKey = user?._id && friendId ? `pastel-chat-color:${user._id}:${friendId}` : null;

  useEffect(() => {
    if (!chatColorStorageKey) {
      setChatColor(null);
      return;
    }
    setChatColor(user?.chatColors?.[friendId] || localStorage.getItem(chatColorStorageKey) || null);
  }, [chatColorStorageKey, friendId, user?.chatColors]);

  const friendIdentity = getPastelColor(chatColor) || getPastelColor(friend?.chatColor) || getPastelIdentity(friendId);

  // Synchronize active AI conversation session
  useEffect(() => {
    const isAi = friendId === 'user_ai_lyra' || friendRef.current?.isAI;
    if (!isAi || !user?._id) {
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
      return;
    }
    api.get('/ai/conversation/session')
      .then(({ data }) => {
        if (data?.sessionId) {
          setActiveSessionId(data.sessionId);
          activeSessionIdRef.current = data.sessionId;
        }
      })
      .catch((err) => {
        console.warn('[Chat] Failed to fetch active AI session:', err.message);
      });
  }, [friendId, user?._id]);

  // Fetch message history — depends on user so it re-runs if auth reloads
  const fetchMessages = useCallback(async (isBackgroundSync = false) => {
    if (!friendId || !user?._id) return;
    if (!isBackgroundSync) {
      setMessages((current) => {
        if (!current || current.length === 0) {
          setLoading(true);
        }
        return current;
      });
    }
    try {
      const { data } = await api.get(`/messages/with/${friendId}?limit=80`);
      const serverMsgs = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : []);
      const pending = loadPendingMessages(user._id).filter((m) => m.receiverId === friendId);

      setMessages((current) => {
        const serverIdSet = new Set(serverMsgs.map((m) => String(m._id)));
        const validCurrent = (current || []).filter((m) => {
          if (m.isSuperseded || m.isArchived) return false;
          // If server returned a complete list (< 80 messages), any persisted server message not in serverIdSet has been archived/superseded/deleted
          if (m._id && !m.clientMessageId) {
            if (serverMsgs.length < 80) {
              return serverIdSet.has(String(m._id));
            }
            if (serverIdSet.size > 0 && serverIdSet.has(String(m._id))) {
              return true;
            }
          }
          return true;
        });
        const merged = mergeMessages(validCurrent, serverMsgs, pending);
        const cleanMerged = merged.filter((m) => !m.isSuperseded && !m.isArchived);
        setCachedConversation(user._id, friendId, { messages: cleanMerged });
        return cleanMerged;
      });
    } catch (err) {
      if (!isBackgroundSync) {
        console.error('Failed to load messages:', err.message);
      }
      // Retain existing cached messages on failure — never wipe to []
    } finally {
      if (!isBackgroundSync) {
        setLoading(false);
      }
    }
  }, [friendId, user?._id]);

  const cancelActiveAiTurn = useCallback((reason = 'cancelled') => {
    if (reactionTimerRef.current) {
      clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = null;
    }
    if (deliveryTimerRef.current) {
      clearTimeout(deliveryTimerRef.current);
      deliveryTimerRef.current = null;
    }
    if (microTurnTimerRef.current) {
      clearTimeout(microTurnTimerRef.current);
      microTurnTimerRef.current = null;
    }
    if (gracePeriodTimerRef.current) {
      clearTimeout(gracePeriodTimerRef.current);
      gracePeriodTimerRef.current = null;
    }
    if (userIdleTimerRef.current) {
      clearTimeout(userIdleTimerRef.current);
      userIdleTimerRef.current = null;
    }
    if (userTypingDebounceTimerRef.current) {
      clearTimeout(userTypingDebounceTimerRef.current);
      userTypingDebounceTimerRef.current = null;
    }
    if (activeAiTurnRef.current) {
      activeAiTurnRef.current.deliveryState = 'cancelled';
      activeAiTurnRef.current.pendingBubbles = [];
    }
    setAiTyping(null);
  }, []);

  const deliverNextAiBubble = useCallback((generationId, revision, elapsedGenerationTime = null, isResumeFinish = false) => {
    const activeTurn = activeAiTurnRef.current;
    if (
      !activeTurn ||
      activeTurn.generationId !== generationId ||
      activeTurn.revision !== revision ||
      activeTurn.deliveryState === 'cancelled'
    ) {
      return;
    }

    if (!Array.isArray(activeTurn.pendingBubbles) || activeTurn.pendingBubbles.length === 0) {
      activeTurn.deliveryState = TURN_STATE.IDLE;
      setAiTyping(null);
      return;
    }

    const finalizeDelivery = () => {
      const currentTurn = activeAiTurnRef.current;
      if (
        !currentTurn ||
        currentTurn.generationId !== generationId ||
        currentTurn.revision !== revision ||
        currentTurn.deliveryState === 'cancelled'
      ) {
        return;
      }

      const bubbleToDeliver = currentTurn.pendingBubbles.shift();
      if (!bubbleToDeliver) return;

      currentTurn.deliveredBubbles.push(bubbleToDeliver);
      aiBubbleIdsInFlightRef.current.delete(bubbleToDeliver._id);

      setMessages((current) => {
        if (current.some((m) => m._id === bubbleToDeliver._id)) return current;
        const next = [...current, bubbleToDeliver];
        if (user?._id) setCachedConversation(user._id, friendId, { messages: next });
        return next;
      });

      if (currentTurn.pendingBubbles.length > 0) {
        currentTurn.deliveryState = TURN_STATE.DELIVERING;
        setAiTyping(null);

        const pauseDuration = calculateInterBubblePause();
        if (deliveryTimerRef.current) clearTimeout(deliveryTimerRef.current);
        deliveryTimerRef.current = setTimeout(() => {
          if (isUserTypingRef.current) {
            currentTurn.deliveryState = TURN_STATE.PAUSED_FOR_USER;
            currentTurn.remainingTypingDelay = calculateHumanCompositionTime(currentTurn.pendingBubbles[0]?.content);
            return;
          }
          deliverNextAiBubbleRef.current?.(generationId, revision, null, false);
        }, pauseDuration);
      } else {
        currentTurn.deliveryState = TURN_STATE.IDLE;
        setAiTyping(null);
      }
    };

    if (isResumeFinish) {
      finalizeDelivery();
      return;
    }

    const nextBubble = activeTurn.pendingBubbles[0];
    const isFirstBubble = activeTurn.deliveredBubbles.length === 0;

    let typingDelay;
    if (isFirstBubble) {
      const elapsed = elapsedGenerationTime != null ? elapsedGenerationTime : (Date.now() - activeTurn.startTime);
      typingDelay = calculateRemainingTypingDelay(nextBubble.content, elapsed);
    } else {
      typingDelay = calculateHumanCompositionTime(nextBubble.content);
    }

    activeTurn.deliveryState = TURN_STATE.TYPING;
    activeTurn.scheduledDeliveryTime = Date.now() + typingDelay;
    activeTurn.remainingTypingDelay = typingDelay;

    const currentFriend = friendRef.current || friend;
    const resolvedAvatar = resolveCharacterAvatar({
      friend: currentFriend,
      sender: nextBubble?.senderId,
      messages,
      friendId: currentFriend?._id || friendId || 'user_ai_lyra',
      userId: user?._id
    });
    const targetUser = currentFriend
      ? { ...currentFriend, avatar: resolvedAvatar }
      : { _id: friendId || 'user_ai_lyra', name: 'Lyra', avatar: resolvedAvatar, isAI: true };

    setAiTyping({
      isTyping: true,
      generationId,
      revision,
      user: targetUser,
      identity: friendIdentity
    });

    if (deliveryTimerRef.current) clearTimeout(deliveryTimerRef.current);
    deliveryTimerRef.current = setTimeout(finalizeDelivery, typingDelay);
  }, [friend, friendId, friendIdentity, messages, user?._id]);

  const resumePausedAiDelivery = useCallback(() => {
    const turn = activeAiTurnRef.current;
    if (
      !turn ||
      turn.deliveryState !== TURN_STATE.PAUSED_FOR_USER ||
      !Array.isArray(turn.pendingBubbles) ||
      turn.pendingBubbles.length === 0
    ) {
      return;
    }

    turn.deliveryState = TURN_STATE.TYPING;
    const resumeDelay = Math.max(turn.remainingTypingDelay || 0, 380);
    turn.scheduledDeliveryTime = Date.now() + resumeDelay;

    const currentFriend = friendRef.current || friend;
    const resolvedAvatar = resolveCharacterAvatar({
      friend: currentFriend,
      sender: turn.pendingBubbles[0]?.senderId,
      messages,
      friendId: currentFriend?._id || friendId || 'user_ai_lyra',
      userId: user?._id
    });
    const targetUser = currentFriend
      ? { ...currentFriend, avatar: resolvedAvatar }
      : { _id: friendId || 'user_ai_lyra', name: 'Lyra', avatar: resolvedAvatar, isAI: true };

    setAiTyping({
      isTyping: true,
      generationId: turn.generationId,
      revision: turn.revision,
      user: targetUser,
      identity: friendIdentity
    });

    if (deliveryTimerRef.current) clearTimeout(deliveryTimerRef.current);
    deliveryTimerRef.current = setTimeout(() => {
      deliverNextAiBubbleRef.current?.(turn.generationId, turn.revision, null, true);
    }, resumeDelay);
  }, [friend, friendId, friendIdentity, messages, user?._id]);

  const commitTurnGeneration = useCallback(async (targetGenId = null, targetRevision = null) => {
    const turn = activeAiTurnRef.current;
    if (!turn) return;
    if (targetGenId && turn.generationId !== targetGenId) return;
    if (targetRevision && turn.revision !== targetRevision) return;
    if (turn.deliveryState === 'cancelled') return;
    if (!turn.messageId) return;

    turn.deliveryState = TURN_STATE.GENERATING;

    // Reaction window before exposing typing indicator
    const reactionDelay = calculateReactionDelay();
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => {
      const current = activeAiTurnRef.current;
      if (
        !current ||
        current.generationId !== turn.generationId ||
        current.revision !== turn.revision ||
        current.deliveryState === 'cancelled'
      ) {
        return;
      }
      if (isUserTypingRef.current) {
        current.deliveryState = TURN_STATE.PAUSED_FOR_USER;
        return;
      }

      const currentFriend = friendRef.current || friend;
      const resolvedAvatar = resolveCharacterAvatar({
        friend: currentFriend,
        messages,
        friendId: currentFriend?._id || friendId || 'user_ai_lyra',
        userId: user?._id
      });
      const targetUser = currentFriend
        ? { ...currentFriend, avatar: resolvedAvatar }
        : { _id: friendId || 'user_ai_lyra', name: 'Lyra', avatar: resolvedAvatar, isAI: true };

      setAiTyping({
        isTyping: true,
        generationId: turn.generationId,
        revision: turn.revision,
        user: targetUser,
        identity: friendIdentity
      });
    }, reactionDelay);

    try {
      const { data } = await api.post('/messages/ai-reply', {
        receiverId: friendId,
        messageId: turn.messageId,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      const current = activeAiTurnRef.current;
      if (
        !current ||
        current.generationId !== turn.generationId ||
        current.revision !== turn.revision ||
        current.deliveryState === 'cancelled'
      ) {
        console.log(`[Turn-Taking] Generation ${turn.generationId} superseded or cancelled; discarding.`);
        return;
      }

      const elapsed = Date.now() - turn.startTime;
      if (data?.deliveryMode === 'server-paced') {
        aiBubbleIdsInFlightRef.current.clear();
        setAiTyping(null);
        current.deliveryState = TURN_STATE.IDLE;
        await fetchMessages(true);
        return;
      }
      if (Array.isArray(data?.aiReplies) && data.aiReplies.length > 0) {
        data.aiReplies.forEach((b) => aiBubbleIdsInFlightRef.current.add(b._id));
        current.pendingBubbles = [...data.aiReplies];

        if (isUserTypingRef.current) {
          current.deliveryState = TURN_STATE.PAUSED_FOR_USER;
          current.remainingTypingDelay = calculateRemainingTypingDelay(data.aiReplies[0].content, elapsed);
          setAiTyping(null);
        } else {
          deliverNextAiBubble(turn.generationId, turn.revision, elapsed, false);
        }
      } else {
        setAiTyping(null);
        current.deliveryState = TURN_STATE.IDLE;
        setTimeout(fetchMessages, 1500);
        setTimeout(fetchMessages, 3500);
      }
    } catch (err) {
      console.error('[Turn-Taking] AI generation failed:', err.message);
      if (activeAiTurnRef.current?.generationId === turn.generationId) {
        cancelActiveAiTurn('error');
      }
    }
  }, [cancelActiveAiTurn, deliverNextAiBubble, fetchMessages, friend, friendId, friendIdentity, messages, user?._id]);

  const handleComposerTyping = useCallback((isTyping) => {
    isUserTypingRef.current = isTyping;

    if (userTypingDebounceTimerRef.current) {
      clearTimeout(userTypingDebounceTimerRef.current);
      userTypingDebounceTimerRef.current = null;
    }

    const isAiFriend = friendId === 'user_ai_lyra' || friend?.isAI;
    if (!isAiFriend) return;

    if (isTyping) {
      if (gracePeriodTimerRef.current) {
        clearTimeout(gracePeriodTimerRef.current);
        gracePeriodTimerRef.current = null;
      }

      userTypingDebounceTimerRef.current = setTimeout(() => {
        const turn = activeAiTurnRef.current;
        if (!turn) return;

        if (turn.deliveryState === TURN_STATE.LISTENING) {
          if (microTurnTimerRef.current) {
            clearTimeout(microTurnTimerRef.current);
            microTurnTimerRef.current = null;
          }
          return;
        }

        if (
          turn.deliveryState === TURN_STATE.TYPING ||
          turn.deliveryState === 'typing' ||
          turn.deliveryState === TURN_STATE.DELIVERING ||
          turn.deliveryState === 'reacting'
        ) {
          const now = Date.now();
          if (turn.scheduledDeliveryTime && turn.scheduledDeliveryTime > now) {
            turn.remainingTypingDelay = Math.max(0, turn.scheduledDeliveryTime - now);
          }
          if (deliveryTimerRef.current) {
            clearTimeout(deliveryTimerRef.current);
            deliveryTimerRef.current = null;
          }
          if (reactionTimerRef.current) {
            clearTimeout(reactionTimerRef.current);
            reactionTimerRef.current = null;
          }

          turn.deliveryState = TURN_STATE.PAUSED_FOR_USER;
          setAiTyping(null);

          if (userIdleTimerRef.current) clearTimeout(userIdleTimerRef.current);
          userIdleTimerRef.current = setTimeout(() => {
            if (activeAiTurnRef.current?.deliveryState === TURN_STATE.PAUSED_FOR_USER) {
              resumePausedAiDelivery();
            }
          }, TURN_CONFIG.USER_IDLE_TIMEOUT_MS);
        }
      }, TURN_CONFIG.USER_TYPING_DEBOUNCE_MS);
    } else {
      if (userIdleTimerRef.current) {
        clearTimeout(userIdleTimerRef.current);
        userIdleTimerRef.current = null;
      }

      const turn = activeAiTurnRef.current;
      if (!turn) return;

      if (turn.deliveryState === TURN_STATE.PAUSED_FOR_USER) {
        if (gracePeriodTimerRef.current) clearTimeout(gracePeriodTimerRef.current);
        gracePeriodTimerRef.current = setTimeout(() => {
          if (activeAiTurnRef.current?.deliveryState === TURN_STATE.PAUSED_FOR_USER) {
            resumePausedAiDelivery();
          }
        }, TURN_CONFIG.USER_STOP_GRACE_PERIOD_MS);
      } else if (turn.deliveryState === TURN_STATE.LISTENING) {
        if (microTurnTimerRef.current) clearTimeout(microTurnTimerRef.current);
        microTurnTimerRef.current = setTimeout(() => {
          commitTurnGenerationRef.current?.();
        }, TURN_CONFIG.MICRO_TURN_WINDOW_MS);
      }
    }
  }, [friend, friendId, resumePausedAiDelivery]);

  useEffect(() => {
    deliverNextAiBubbleRef.current = deliverNextAiBubble;
  }, [deliverNextAiBubble]);

  useEffect(() => {
    commitTurnGenerationRef.current = commitTurnGeneration;
  }, [commitTurnGeneration]);

  // Invalidate turn and clear timers on conversation switch
  useEffect(() => {
    cancelActiveAiTurn('conversation_change');
    aiBubbleIdsInFlightRef.current.clear();
    isUserTypingRef.current = false;
  }, [friendId, cancelActiveAiTurn]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      cancelActiveAiTurn('unmount');
    };
  }, [cancelActiveAiTurn]);

  useEffect(() => {
    if (!colorPickerOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!colorPickerRef.current?.contains(event.target)) setColorPickerOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [colorPickerOpen]);

  // Search state
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const searchInputRef = useRef(null);

  // Load friend info
  useEffect(() => {
    if (!friendId) return;
    api.get(`/users/${friendId}`)
      .then(({ data }) => {
        if (!data) return;
        setFriend(data);
        friendRef.current = data;
        if (user?._id) {
          setCachedConversation(user._id, friendId, { friend: data });
        }
      })
      .catch((err) => {
        console.warn('[Chat] Failed to refresh friend profile:', err.message);
        const cached = getCachedConversation(user?._id, friendId);
        if (!cached?.friend && !friendRef.current) {
          navigate('/friends');
        }
      });
  }, [friendId, navigate, user?._id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Adaptive real-time synchronization loop for Vercel Serverless & WebSocket fallback
  useEffect(() => {
    if (!friendId || !user?._id) return;

    let syncTimer = null;
    let isDisposed = false;

    const performSync = async () => {
      if (isDisposed) return;
      try {
        await fetchMessages(true);
      } catch {}
      if (!isDisposed) {
        const interval = reconciliationDelay({ relayMode, connected, visible: document.visibilityState === 'visible' });
        syncTimer = setTimeout(performSync, interval);
      }
    };

    // Recurring sync interval: 1.5s when tab is visible, 15s in background
    syncTimer = setTimeout(performSync, 1500);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(syncTimer);
        performSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      isDisposed = true;
      clearTimeout(syncTimer);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [connected, fetchMessages, friendId, relayMode, user?._id]);

  useEffect(() => {
    if (friendId === 'user_ai_lyra' || friend?.isAI) {
      api.get('/ai/status')
        .then(res => {
          if (res.data?.state?.current_activity) {
            setAiActivity(res.data.state.current_activity);
          }
        })
        .catch(() => {});
    }
  }, [friendId, friend?.isAI]);

  const sendPendingMessage = useCallback(async (pending) => {
    if (pendingSendInFlightRef.current.has(pending.clientMessageId)) return;
    pendingSendInFlightRef.current.add(pending.clientMessageId);

    const isAiFriend = friendId === 'user_ai_lyra' || friend?.isAI;
    let generationId = null;
    let turnRevision = null;

    if (isAiFriend) {
      turnRevision = ++conversationRevisionRef.current;
      generationId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // Cancel older generation / undelivered response (RECONSIDER)
      cancelActiveAiTurn('reconsider_new_message');

      const newTurn = {
        generationId,
        revision: turnRevision,
        clientMessageId: pending.clientMessageId,
        messageId: null,
        deliveryState: TURN_STATE.LISTENING,
        startTime: Date.now(),
        pendingBubbles: [],
        deliveredBubbles: [],
        scheduledDeliveryTime: null,
        remainingTypingDelay: 0
      };
      activeAiTurnRef.current = newTurn;

    }

    try {
      // User message is persisted and broadcast immediately with generateAiReply: false
      const { data } = await api.post('/messages', {
        receiverId: friendId,
        content: pending.content,
        media: pending.media,
        replyTo: pending.replyToId || null,
        clientMessageId: pending.clientMessageId,
        generateAiReply: false,
        conversationSessionId: isAiFriend ? (activeSessionIdRef.current || undefined) : undefined
      });
      if (isAiFriend && activeAiTurnRef.current?.generationId === generationId) {
        activeAiTurnRef.current.messageId = data._id;
        if (microTurnTimerRef.current) clearTimeout(microTurnTimerRef.current);
        microTurnTimerRef.current = setTimeout(() => {
          if (!isUserTypingRef.current) commitTurnGenerationRef.current?.(generationId, turnRevision);
        }, Math.max(0, TURN_CONFIG.MICRO_TURN_WINDOW_MS - (Date.now() - activeAiTurnRef.current.startTime)));
      }
      setMessages((current) => current.map((message) => (
        message.clientMessageId === pending.clientMessageId
          ? { ...data, deliveryStatus: data.deliveryStatus || 'sent' }
          : message
      )));
      removePendingMessage(user?._id, pending.clientMessageId);
      setTimeout(() => fetchMessages(true), 400);
      setTimeout(() => fetchMessages(true), 1200);
      setTimeout(() => fetchMessages(true), 2500);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'SESSION_MISMATCH') {
        const newSessionId = err.response.data.activeSessionId;
        if (newSessionId) {
          activeSessionIdRef.current = newSessionId;
          setActiveSessionId(newSessionId);
        }
        await fetchMessages(true);
        try {
          const { data } = await api.post('/messages', {
            receiverId: friendId,
            content: pending.content,
            media: pending.media,
            replyTo: pending.replyToId || null,
            clientMessageId: pending.clientMessageId,
            generateAiReply: false,
            conversationSessionId: newSessionId
          });
          if (isAiFriend && activeAiTurnRef.current?.generationId === generationId) {
            activeAiTurnRef.current.messageId = data._id;
            if (microTurnTimerRef.current) clearTimeout(microTurnTimerRef.current);
            microTurnTimerRef.current = setTimeout(() => {
              if (!isUserTypingRef.current) commitTurnGenerationRef.current?.(generationId, turnRevision);
            }, Math.max(0, TURN_CONFIG.MICRO_TURN_WINDOW_MS - (Date.now() - activeAiTurnRef.current.startTime)));
          }
          setMessages((current) => current.map((message) => (
            message.clientMessageId === pending.clientMessageId
              ? { ...data, deliveryStatus: data.deliveryStatus || 'sent' }
              : message
          )));
          removePendingMessage(user?._id, pending.clientMessageId);
          setTimeout(() => fetchMessages(true), 400);
          return;
        } catch (retryErr) {
          console.error('[Chat] Session mismatch retry failed:', retryErr.message);
        }
      }

      console.error('Send failed:', err.message);
      savePendingMessage(user?._id, { ...pending, deliveryStatus: 'failed' });
      setMessages((current) => current.map((message) => (
        message.clientMessageId === pending.clientMessageId
          ? { ...message, deliveryStatus: 'failed' }
          : message
      )));
      if (isAiFriend && activeAiTurnRef.current?.generationId === generationId) {
        cancelActiveAiTurn('error');
      }
    } finally {
      pendingSendInFlightRef.current.delete(pending.clientMessageId);
    }
  }, [cancelActiveAiTurn, fetchMessages, friend, friendId, user?._id]);

  useEffect(() => {
    if (!connected || !user?._id || !friendId) return;
    loadPendingMessages(user._id)
      .filter((message) => message.receiverId === friendId)
      .forEach((message) => void sendPendingMessage(message));
  }, [connected, friendId, sendPendingMessage, user?._id]);

  useEffect(() => {
    if (!user?._id || !friendId || loading) return;
    const pending = loadPendingMessages(user._id).filter((message) => message.receiverId === friendId);
    pending.forEach((message) => {
      if (recoveredPendingRef.current.has(message.clientMessageId)) return;
      recoveredPendingRef.current.add(message.clientMessageId);
      setMessages((current) => current.some((item) => item.clientMessageId === message.clientMessageId) ? current : [...current, message]);
      void sendPendingMessage(message);
    });
  }, [friendId, loading, sendPendingMessage, user?._id]);

  // Socket listeners — scoped to this conversation
  useEffect(() => {
    if (!socket || !friendId || !user) return;

    const roomKey = `${user._id}:${friendId}`;
    const reverseKey = `${friendId}:${user._id}`;

    const onMessage = (msg) => {
      const senderId = msg.senderId?._id || msg.senderId;

      // If this message belongs to an AI generation that the coordinator is currently pacing,
      // let the coordinator deliver it at the natural typing moment rather than popping in early
      if (msg.aiDeliveryMode !== 'server-paced' && aiBubbleIdsInFlightRef.current.has(msg._id)) {
        return;
      }

      // If an active AI turn is in-flight for this chat, stash ID to let coordinator deliver it naturally
      if (
        (senderId === 'user_ai_lyra' || (friend && (friend._id === senderId || friendId === senderId) && friend.isAI)) &&
        activeAiTurnRef.current &&
        activeAiTurnRef.current.deliveryState !== 'completed' &&
        activeAiTurnRef.current.deliveryState !== 'cancelled' &&
        msg.aiDeliveryMode !== 'server-paced'
      ) {
        aiBubbleIdsInFlightRef.current.add(msg._id);
        return;
      }

      setMessages((prev) => {
        const existing = prev.find((m) => m._id === msg._id || (
          msg.clientMessageId && m.clientMessageId === msg.clientMessageId
        ));
        const updated = existing
          ? prev.map((message) => message === existing
            ? { ...msg, deliveryStatus: message.deliveryStatus === 'failed' ? 'failed' : 'sent' }
            : message)
          : [...prev, msg];
        if (user?._id) setCachedConversation(user._id, friendId, { messages: updated });
        return updated;
      });
      if (senderId !== user._id && document.visibilityState === 'visible') {
        if (!deliveredAckRef.current.has(msg._id)) {
          deliveredAckRef.current.add(msg._id);
          if (relayMode) api.post(`/messages/${msg._id}/delivered`).catch(() => {});
          else socket.emit('message:delivered', { messageId: msg._id });
        }
      }
    };

    const onMessageStatus = ({ messageId, clientMessageId, status, deliveredAt, readAt }) => {
      setMessages((prev) => prev.map((message) => {
        if (message._id !== messageId && (!clientMessageId || message.clientMessageId !== clientMessageId)) return message;
        const currentStatus = message.deliveryStatus || 'sent';
        if ((DELIVERY_RANK[status] ?? 0) < (DELIVERY_RANK[currentStatus] ?? 0)) return message;
        return { ...message, deliveryStatus: status, deliveredAt: deliveredAt || message.deliveredAt, readAt: readAt || message.readAt };
      }));
    };

    const onRecall = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, isRecalled: true, content: 'This message has been recalled' }
            : m
        )
      );
    };

    const onReaction = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => m._id === messageId ? { ...m, reactions } : m)
      );
    };

    const onTyping = ({ from, isTyping }) => {
      if (!from || from._id === user._id) return;
      // Do not let raw server typing pulses override the natural pacing coordinator for AI
      if (from._id === 'user_ai_lyra' || (friend && (friend._id === from._id || friendId === from._id) && friend.isAI)) {
        return;
      }
      clearTimeout(typingRef.current[from._id]);
      if (isTyping) {
        setTypingUsers((prev) => {
          if (prev.find((u) => u.userId === from._id)) return prev;
          return [...prev, { userId: from._id, name: from.name, avatar: from.avatar }];
        });
        typingRef.current[from._id] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== from._id));
        }, 4000);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== from._id));
      }
    };

    const onUserUpdated = (data) => {
      if (data && data.userId === friendId) {
        setFriend((prev) => {
          const updated = prev ? { ...prev, avatar: data.avatar } : { _id: friendId, avatar: data.avatar };
          friendRef.current = updated;
          return updated;
        });
        setAiTyping((prev) => (prev ? { ...prev, user: { ...(prev.user || {}), avatar: data.avatar } } : null));
        if (user?._id) {
          setCachedConversation(user._id, friendId, {
            friend: { ...(friendRef.current || {}), avatar: data.avatar },
            resolvedAvatar: data.avatar
          });
        }
      }
    };

    const onMsgSuperseded = ({ messageIds, supersededIds }) => {
      const ids = messageIds || supersededIds || [];
      if (!Array.isArray(ids) || ids.length === 0) return;
      const set = new Set(ids.map(String));
      setMessages((prev) => {
        const next = (prev || []).filter((m) => !set.has(String(m._id)));
        if (user?._id) setCachedConversation(user._id, friendId, { messages: next });
        return next;
      });
    };

    const onAiSessionRefreshed = (data) => {
      if (data?.sessionId) {
        setActiveSessionId(data.sessionId);
        activeSessionIdRef.current = data.sessionId;
      }
      if (data?.mode === 'clear') {
        cancelActiveAiTurn('session_cleared');
        aiBubbleIdsInFlightRef.current.clear();
        setMessages([]);
        if (user?._id) setCachedConversation(user._id, friendId, { messages: [] });
      }
      fetchMessages(true);
    };

    const onAiChatCleared = (data) => {
      if (friendId === 'user_ai_lyra' || friend?.isAI || data?.characterId === friend?.aiCharacterId) {
        cancelActiveAiTurn('session_cleared');
        aiBubbleIdsInFlightRef.current.clear();
        setMessages([]);
        if (user?._id) setCachedConversation(user._id, friendId, { messages: [] });
        fetchMessages(true);
      }
    };

    socket.on(`msg:${roomKey}`, onMessage);
    socket.on(`msg:${reverseKey}`, onMessage);
    socket.on(`msg_recall:${roomKey}`, onRecall);
    socket.on(`msg_recall:${reverseKey}`, onRecall);
    socket.on(`msg_reaction:${roomKey}`, onReaction);
    socket.on(`msg_reaction:${reverseKey}`, onReaction);
    socket.on(`typing:${user._id}`, onTyping);
    socket.on('message_status', onMessageStatus);
    socket.on('user_updated', onUserUpdated);
    socket.on('msg_superseded', onMsgSuperseded);
    socket.on(`msg_superseded:${roomKey}`, onMsgSuperseded);
    socket.on(`msg_superseded:${reverseKey}`, onMsgSuperseded);
    socket.on('ai_session_refreshed', onAiSessionRefreshed);
    socket.on(`ai_session_refreshed:${roomKey}`, onAiSessionRefreshed);
    socket.on('ai_chat_cleared', onAiChatCleared);
    socket.on(`ai_chat_cleared:${roomKey}`, onAiChatCleared);
    // Re-fetch on socket reconnect to catch messages missed while disconnected
    socket.on('connect', fetchMessages);

    // Mark active chat on server so push notifications are suppressed while viewing this chat
    socket.emit('chat:active', { friendId });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        socket.emit('chat:active', { friendId });
      } else {
        socket.emit('chat:inactive', { friendId });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socket.emit('chat:inactive', { friendId });
      socket.off(`msg:${roomKey}`, onMessage);
      socket.off(`msg:${reverseKey}`, onMessage);
      socket.off(`msg_recall:${roomKey}`, onRecall);
      socket.off(`msg_recall:${reverseKey}`, onRecall);
      socket.off(`msg_reaction:${roomKey}`, onReaction);
      socket.off(`msg_reaction:${reverseKey}`, onReaction);
      socket.off(`typing:${user._id}`, onTyping);
      socket.off('message_status', onMessageStatus);
      socket.off('user_updated', onUserUpdated);
      socket.off('msg_superseded', onMsgSuperseded);
      socket.off(`msg_superseded:${roomKey}`, onMsgSuperseded);
      socket.off(`msg_superseded:${reverseKey}`, onMsgSuperseded);
      socket.off('ai_session_refreshed', onAiSessionRefreshed);
      socket.off(`ai_session_refreshed:${roomKey}`, onAiSessionRefreshed);
      socket.off('ai_chat_cleared', onAiChatCleared);
      socket.off(`ai_chat_cleared:${roomKey}`, onAiChatCleared);
      socket.off('connect', fetchMessages);
    };
  }, [socket, friendId, user, fetchMessages, friend, relayMode, cancelActiveAiTurn]);

  // A fetched message has reached this client even if it arrived while the
  // recipient was offline. Delivery is acknowledged once per message.
  useEffect(() => {
    if (!user || document.visibilityState !== 'visible') return;
    messages.forEach((message) => {
      const senderId = message.senderId?._id || message.senderId;
      if (senderId === user._id || deliveredAckRef.current.has(message._id)) return;
      deliveredAckRef.current.add(message._id);
      if (socket && socket.connected && !relayMode) {
        socket.emit('message:delivered', { messageId: message._id });
      } else {
        api.post(`/messages/${message._id}/delivered`).catch(() => {});
      }
    });
  }, [messages, relayMode, socket, user]);

  // Collapse sidebar on resize to mobile
  useEffect(() => {
    const onResize = () => { if (isMobile()) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Keep the document itself stationary while iOS Safari resizes the chat
  // shell around its software keyboard. The message list remains the only
  // scrollable region.
  useEffect(() => {
    const documentRoot = document.documentElement;
    const resetDocumentScroll = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };

    documentRoot.classList.add('chat-viewport-lock');
    document.body.classList.add('chat-viewport-lock');
    window.addEventListener('scroll', resetDocumentScroll, { passive: true });
    resetDocumentScroll();

    return () => {
      window.removeEventListener('scroll', resetDocumentScroll);
      documentRoot.classList.remove('chat-viewport-lock');
      document.body.classList.remove('chat-viewport-lock');
    };
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [searchOpen]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await api.get(`/messages/search/${friendId}?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []));
      } catch (e) {
        console.error('Search failed:', e);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, friendId]);

  const jumpToMessage = (msgId) => {
    setSearchOpen(false);
    setHighlightId(msgId);
    setTimeout(() => {
      const el = document.getElementById(`msg-${msgId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    setTimeout(() => setHighlightId(null), 2500);
  };

  const handleSend = useCallback(async (content, media) => {
    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const pending = {
      _id: clientMessageId,
      clientMessageId,
      senderId: user._id,
      receiverId: friendId,
      content: content || '',
      media: media || null,
      replyToId: replyingTo?._id || null,
      timestamp: new Date().toISOString(),
      deliveryStatus: 'sending',
      isRecalled: false,
      isPinned: false,
      reactions: {}
    };
    setMessages((current) => {
      const next = [...current, pending];
      if (user?._id) setCachedConversation(user._id, friendId, { messages: next });
      return next;
    });
    savePendingMessage(user._id, pending);
    setReplyingTo(null);
    void sendPendingMessage(pending);
  }, [friendId, replyingTo, sendPendingMessage, user?._id]);

  const handleRetry = useCallback((message) => {
    if (!message.clientMessageId) return;
    const pending = {
      ...message,
      replyToId: message.replyTo?._id || null,
      deliveryStatus: 'sending'
    };
    savePendingMessage(user._id, pending);
    setMessages((current) => current.map((item) => item._id === message._id ? pending : item));
    void sendPendingMessage(pending);
  }, [sendPendingMessage, user?._id]);

  const handleMessageVisible = useCallback((message) => {
    const senderId = message.senderId?._id || message.senderId;
    if (!user || senderId === user._id || document.visibilityState !== 'visible' || readAckRef.current.has(message._id)) return;
    readAckRef.current.add(message._id);
    if (socket && socket.connected && !relayMode) {
      socket.emit('message:read', { messageId: message._id });
    } else {
      api.post(`/messages/${message._id}/read`).catch(() => {});
    }
  }, [relayMode, socket, user]);

  const handleRecall = (messageId) => {
    setMessages((prev) =>
      prev.map((m) =>
        m._id === messageId
          ? { ...m, isRecalled: true, content: 'This message has been recalled' }
          : m
      )
    );
  };

  const handleReaction = (messageId, reactions) => {
    setMessages((prev) =>
      prev.map((m) => m._id === messageId ? { ...m, reactions } : m)
    );
  };

  const handleAIAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    // Reset input value so the same file can be re-selected if needed
    if (event.target) event.target.value = '';
    if (!file) return;
    if (avatarUploading) return; // Prevent duplicate uploads

    setAvatarUploading(true);
    const previousAvatar = friend?.avatar || DEFAULT_LYRA_AVATAR;
    let prepared = null;
    try {
      prepared = await prepareLyraAvatarUpload(file);
      const preview = prepared.previewUrl;
      setLyraAvatar(preview);
      setFriend((prev) => {
        const updated = prev ? { ...prev, avatar: preview } : { _id: friendId || 'user_ai_lyra', name: 'Lyra', avatar: preview, isAI: true };
        friendRef.current = updated;
        return updated;
      });
      setAiTyping((prev) => (prev ? { ...prev, user: { ...(prev.user || {}), avatar: preview } } : null));

      const res = await api.post('/ai/avatar', { avatar: prepared.dataUrl });
      if (!res.data?.success) throw new Error('Failed to update avatar');
      const newAvatar = res.data.avatar;
      setLyraAvatar(newAvatar);
      setFriend((prev) => {
        const updated = prev ? { ...prev, avatar: newAvatar } : { _id: friendId || 'user_ai_lyra', name: 'Lyra', avatar: newAvatar, isAI: true };
        friendRef.current = updated;
        return updated;
      });
      setAiTyping((prev) => (prev ? { ...prev, user: { ...(prev.user || {}), avatar: newAvatar } } : null));
      if (user?._id) {
        setCachedConversation(user._id, friendId || 'user_ai_lyra', {
          friend: { ...(friendRef.current || {}), avatar: newAvatar },
          resolvedAvatar: newAvatar
        });
      }
      push({ title: 'Avatar updated!', tone: 'ok', icon: 'check' });
    } catch (err) {
      setLyraAvatar(previousAvatar);
      setFriend((prev) => {
        const updated = prev ? { ...prev, avatar: previousAvatar } : prev;
        friendRef.current = updated;
        return updated;
      });
      setAiTyping((prev) => (prev ? { ...prev, user: { ...(prev.user || {}), avatar: previousAvatar } } : null));
      push({ title: err.response?.data?.message || err.message || 'Failed to update avatar', tone: 'danger', icon: 'alert' });
    } finally {
      prepared?.dispose();
      setAvatarUploading(false);
    }
  };

  const handleAIAvatarUrlPrompt = async () => {
    const url = window.prompt('Enter image URL for avatar:', friend?.avatar || '');
    if (url && url.trim()) {
      try {
        const res = await api.post('/ai/avatar', { avatar: url.trim() });
        if (res.data?.success) {
          const newAvatar = res.data.avatar;
          setFriend((prev) => {
            const updated = prev ? { ...prev, avatar: newAvatar } : { _id: friendId || 'user_ai_lyra', name: 'Lyra', avatar: newAvatar, isAI: true };
            friendRef.current = updated;
            return updated;
          });
          setAiTyping((prev) => (prev ? { ...prev, user: { ...(prev.user || {}), avatar: newAvatar } } : null));
          if (user?._id) {
            setCachedConversation(user._id, friendId || 'user_ai_lyra', {
              friend: { ...(friendRef.current || {}), avatar: newAvatar },
              resolvedAvatar: newAvatar
            });
          }
          push({ title: 'Avatar updated successfully', tone: 'ok', icon: 'check' });
        }
      } catch (err) {
        push({ title: err.response?.data?.error || 'Failed to update avatar', tone: 'danger', icon: 'alert' });
      }
    }
  };

  const handleRegenerate = useCallback(async (userMessageId) => {
    if (isRegenerating || !userMessageId) return;
    setIsRegenerating(true);
    cancelActiveAiTurn('regenerate');
    aiBubbleIdsInFlightRef.current.clear();

    try {
      const { data } = await api.post('/messages/regenerate', {
        receiverId: friendId,
        messageId: userMessageId,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      if (data?.supersededIds && data.supersededIds.length > 0) {
        const set = new Set(data.supersededIds.map(String));
        setMessages((prev) => {
          const next = (prev || []).filter((m) => !set.has(String(m._id)));
          if (user?._id) setCachedConversation(user._id, friendId, { messages: next });
          return next;
        });
      }

      if (Array.isArray(data?.aiReplies) && data.aiReplies.length > 0) {
        if (data.deliveryMode === 'client-paced') {
          const turnRevision = ++conversationRevisionRef.current;
          const generationId = `gen-regen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          data.aiReplies.forEach((b) => aiBubbleIdsInFlightRef.current.add(b._id));
          const newTurn = {
            generationId,
            revision: turnRevision,
            clientMessageId: `regen-${userMessageId}`,
            messageId: userMessageId,
            deliveryState: TURN_STATE.DELIVERING,
            startTime: Date.now(),
            pendingBubbles: [...data.aiReplies],
            deliveredBubbles: [],
            scheduledDeliveryTime: null,
            remainingTypingDelay: 0
          };
          activeAiTurnRef.current = newTurn;
          deliverNextAiBubble(generationId, turnRevision, null, false);
        } else {
          setMessages((prev) => {
            const next = mergeMessages(prev, data.aiReplies).filter((m) => !m.isSuperseded);
            if (user?._id) setCachedConversation(user._id, friendId, { messages: next });
            return next;
          });
        }
      }

      setTimeout(() => fetchMessages(true), 400);
      setTimeout(() => fetchMessages(true), 1200);
    } catch (err) {
      console.error('[Chat] Regenerate failed:', err.message);
      const msg = err.response?.data?.message || err.message || 'Failed to regenerate';
      push({ title: msg, tone: 'danger', icon: 'alert' });
    } finally {
      setIsRegenerating(false);
    }
  }, [cancelActiveAiTurn, deliverNextAiBubble, fetchMessages, friendId, isRegenerating, push, user?._id]);

  const handleRefreshChat = useCallback(() => {
    setRefreshModalOpen(true);
  }, []);

  const handleRefreshClear = useCallback(async () => {
    setRefreshLoading(true);
    cancelActiveAiTurn('refresh_clear');
    aiBubbleIdsInFlightRef.current.clear();

    try {
      const { data } = await api.post('/ai/conversation/refresh', {
        characterId: friend?.aiCharacterId || 'char_lyra',
        mode: 'clear'
      });
      if (data?.sessionId) {
        setActiveSessionId(data.sessionId);
        activeSessionIdRef.current = data.sessionId;
      }
      setMessages([]);
      if (user?._id) setCachedConversation(user._id, friendId, { messages: [] });
      setRefreshModalOpen(false);
      push({
        title: t('refreshChatSuccessClear') || 'Cleared chat and started fresh with Lyra',
        tone: 'ok',
        icon: 'check'
      });
      setTimeout(() => fetchMessages(true), 400);
    } catch (err) {
      console.error('[Chat] Refresh clear failed:', err.message);
      push({
        title: err.response?.data?.message || err.message || 'Failed to refresh chat',
        tone: 'danger',
        icon: 'alert'
      });
    } finally {
      setRefreshLoading(false);
    }
  }, [cancelActiveAiTurn, fetchMessages, friend?.aiCharacterId, friendId, push, t, user?._id]);

  const handleRefreshKeep = useCallback(async () => {
    setRefreshLoading(true);
    cancelActiveAiTurn('refresh_keep');
    aiBubbleIdsInFlightRef.current.clear();

    try {
      const { data } = await api.post('/ai/conversation/refresh', {
        characterId: friend?.aiCharacterId || 'char_lyra',
        mode: 'keep'
      });
      if (data?.sessionId) {
        setActiveSessionId(data.sessionId);
        activeSessionIdRef.current = data.sessionId;
      }
      if (data?.boundaryMessage) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.boundaryMessage._id)) return prev;
          const next = [...prev, data.boundaryMessage];
          if (user?._id) setCachedConversation(user._id, friendId, { messages: next });
          return next;
        });
      }
      setRefreshModalOpen(false);
      push({
        title: t('refreshChatSuccessKeep') || t('refreshChatSuccess') || 'Started a fresh conversation context 🌱',
        tone: 'ok',
        icon: 'check'
      });
      setTimeout(() => fetchMessages(true), 400);
    } catch (err) {
      console.error('[Chat] Refresh keep failed:', err.message);
      push({
        title: err.response?.data?.message || err.message || 'Failed to refresh chat',
        tone: 'danger',
        icon: 'alert'
      });
    } finally {
      setRefreshLoading(false);
    }
  }, [cancelActiveAiTurn, fetchMessages, friend?.aiCharacterId, friendId, push, t, user?._id]);

  const formatSearchTime = (ts) =>
    new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const selectChatColor = (colorId) => {
    setChatColor(colorId);
    if (chatColorStorageKey) localStorage.setItem(chatColorStorageKey, colorId);
    updateProfile({ chatColors: { ...(user?.chatColors || {}), [friendId]: colorId } });
    setColorPickerOpen(false);
  };

  const resetChatColor = () => {
    setChatColor(null);
    if (chatColorStorageKey) localStorage.removeItem(chatColorStorageKey);
    const nextChatColors = { ...(user?.chatColors || {}) };
    delete nextChatColors[friendId];
    updateProfile({ chatColors: nextChatColors });
    setColorPickerOpen(false);
  };

  return (
    <div className="chat-page-shell" style={{
      position: 'fixed',
      top: 'var(--visual-offset-top, 0px)', left: 0, right: 0,
      height: 'var(--visual-height, 100dvh)',
      overflow: 'hidden',
      background: 'var(--cream)'
    }}>
      <Header
        friend={friend}
        friendId={friendId}
        friendIdentity={friendIdentity}
        messages={messages}
        onOpenProfile={() => setProfileOpen(v => !v)}
        onMobileAvatarChange={handleAIAvatarChange}
        avatarUploading={avatarUploading}
      />

      {/* The bounded shell shrinks to visualViewport.height when the keyboard opens. */}
      <div className="chat-shell" style={{
        position: 'absolute',
        top: 'calc(60px + env(safe-area-inset-top))',
        left: 0, right: 0, bottom: 0,
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="chat-main" style={{
            display: 'flex',
            flexDirection: 'column',
            width: isMobile() ? '100%' : '220px',
            flexShrink: 0,
            overflow: 'hidden',
            position: isMobile() ? 'absolute' : 'relative',
            top: 0, left: 0, bottom: 0,
            zIndex: isMobile() ? 20 : 'auto',
            background: 'var(--cream)'
          }}>
            {isMobile() && (
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  margin: '8px 12px 0',
                  padding: '6px 12px',
                  background: 'var(--soft-pink)',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <PastelIcon name="close" size={15} /> Close
              </button>
            )}
            <OnlineUsers />
          </div>
        )}

        {/* Main chat area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0, position: 'relative' }}>
          {/* Toolbar */}
          <div className="chat-toolbar" style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card-bg)',
            gap: '8px',
            flexShrink: 0
          }}>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? 'Hide online users' : 'Show online users'}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '4px 10px',
                fontSize: '12px', color: 'var(--subtext)',
                cursor: 'pointer', transition: 'all 0.15s',
                flexShrink: 0
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,182,193,0.1)';
                e.currentTarget.style.borderColor = '#FFB6C1';
                e.currentTarget.style.color = '#FF8FA3';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = '#AAAAAA';
              }}
            >
              {sidebarOpen ? '◀ Hide' : '▶ Online'}
            </button>

            {(friend || friendId === 'user_ai_lyra') && (
              <div className="chat-contact" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                {/* Clickable avatar — opens profile card */}
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                  title="View profile"
                >
                  <img
                    src={resolveCharacterAvatar({ friend, messages, friendId, userId: user?._id })}
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: '50%', display: 'block', border: `2px solid ${friendIdentity.accent}`, objectFit: 'cover' }}
                  />
                </button>
                <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => setProfileOpen(v => !v)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'block'
                    }}>
                      {friend?.name || (friendId === 'user_ai_lyra' ? 'Lyra' : '')}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: (friend?.status ? '#B08ABD' : (friend?.isOnline || friendId === 'user_ai_lyra' ? '#4fa865' : '#bbb')) }}>
                    {friend?.status || (aiActivity ? `☕ ${aiActivity}` : (friend?.isOnline || friendId === 'user_ai_lyra' ? 'Online' : 'Offline'))}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="chat-actions" ref={colorPickerRef} style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', position: 'relative' }}>
                  {/* Search toggle */}
                  <button
                    onClick={() => setSearchOpen(v => !v)}
                    title="Search messages"
                    style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: searchOpen ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : '#F7F0FA',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, border: 'none', cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                      transition: 'transform 0.15s, background 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  ><PastelIcon name="search" size={17} /></button>

                  <button
                    onClick={() => startCall(friend, 'voice')}
                    disabled={!!activeCall}
                    title="Voice call"
                    style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: activeCall ? '#eee' : 'linear-gradient(135deg, #C8E6C9, #A5D6A7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, border: 'none', cursor: activeCall ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      transition: 'transform 0.15s'
                    }}
                    onMouseEnter={e => !activeCall && (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  ><PastelIcon name="phone" size={17} /></button>
                  <button
                    onClick={() => startCall(friend, 'video')}
                    disabled={!!activeCall}
                    title="Video call"
                    style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: activeCall ? '#eee' : 'linear-gradient(135deg, #BBDEFB, #90CAF9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, border: 'none', cursor: activeCall ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      transition: 'transform 0.15s'
                    }}
                    onMouseEnter={e => !activeCall && (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  ><PastelIcon name="video" size={17} /></button>
                  <button
                    type="button"
                    onClick={() => setColorPickerOpen(v => !v)}
                    title="Change chat color"
                    aria-label="Change chat color"
                    aria-expanded={colorPickerOpen}
                    style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: friendIdentity.soft,
                      color: friendIdentity.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', cursor: 'pointer',
                      boxShadow: `0 2px 6px ${friendIdentity.accent}44`,
                      transition: 'transform 0.15s, background 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  ><PastelIcon name="palette" size={17} /></button>

                  {(friend?._id === 'user_ai_lyra' || friend?.isAI || friendId === 'user_ai_lyra') && (
                    <>
                      <button
                        type="button"
                        onClick={handleRefreshChat}
                        title={t('refreshChat') || 'Refresh Chat'}
                        aria-label="Refresh Chat"
                        style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: '#F7F0FA',
                          color: 'var(--subtext)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid var(--border)', cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                          transition: 'transform 0.15s, color 0.15s, border-color 0.15s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'scale(1.1)';
                          e.currentTarget.style.color = friendIdentity.accent;
                          e.currentTarget.style.borderColor = friendIdentity.accent;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.color = 'var(--subtext)';
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                      >
                        <PastelIcon name="refresh" size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCharacterStudio(true)}
                        title={t('customizeLyra') || 'Customize Lyra'}
                        aria-label="Customize Lyra"
                        style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #FFF0F5, #FFE4E1)',
                          color: friendIdentity.accent,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `1.5px solid ${friendIdentity.accent}`, cursor: 'pointer',
                          boxShadow: `0 2px 6px ${friendIdentity.accent}33`,
                          transition: 'transform 0.15s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        <PastelIcon name="sparkles" size={17} style={{ color: friendIdentity.accent }} />
                      </button>
                    </>
                  )}

                  {colorPickerOpen && (
                    <div role="dialog" aria-label="Choose chat color" style={{
                      position: 'absolute', top: 42, right: 0, zIndex: 30,
                      width: 224, padding: 12, borderRadius: 16,
                      background: 'var(--card-bg)', border: '1px solid var(--border)',
                      boxShadow: '0 10px 28px rgba(80,50,70,0.18)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Chat color</span>
                        <button type="button" onClick={resetChatColor} style={{ border: 0, background: 'none', color: 'var(--subtext)', fontSize: 11, cursor: 'pointer', padding: 2 }}>Auto</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 9 }}>
                        {PASTEL_IDENTITY_PALETTE.map((color) => (
                          <button
                            key={color.id}
                            type="button"
                            title={color.label}
                            aria-label={color.label}
                            aria-pressed={chatColor === color.id}
                            onClick={() => selectChatColor(color.id)}
                            style={{
                              width: 28, height: 28, borderRadius: '50%', background: color.bubble,
                              border: chatColor === color.id ? `3px solid ${color.accent}` : '2px solid transparent',
                              boxShadow: chatColor === color.id ? `0 0 0 3px ${color.soft}` : '0 1px 4px rgba(80,50,70,0.14)',
                              cursor: 'pointer', padding: 0
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Friend profile card (collapsible) */}
          {profileOpen && friend && (
            <div style={{
              background: friendIdentity.soft, borderBottom: `2px solid ${friendIdentity.accent}`,
              padding: '14px 16px', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 14
            }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={resolveCharacterAvatar({ friend, messages, friendId, userId: user?._id })}
                  alt=""
                  style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${friendIdentity.accent}`, objectFit: 'cover', display: 'block' }}
                />
                {(friend._id === 'user_ai_lyra' || friend.isAI) && (
                  <label
                    title="Upload custom avatar"
                    style={{
                      position: 'absolute', bottom: -2, right: -2,
                      background: 'white', border: `2px solid ${friendIdentity.accent}`,
                      borderRadius: '50%', width: 24, height: 24,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                    }}
                  >
                    <PastelIcon name="camera" size={13} style={{ color: friendIdentity.accent }} />
                    <input
                      type="file"
                      accept="image/*"
                      aria-label="Choose Lyra avatar image"
                      style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                        opacity: 0, cursor: 'pointer', margin: 0, padding: 0, border: 0
                      }}
                      onChange={handleAIAvatarChange}
                    />
                  </label>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{friend.name}</div>
                  {(friend._id === 'user_ai_lyra' || friend.isAI) && (
                    <button
                      type="button"
                      onClick={handleAIAvatarUrlPrompt}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: friendIdentity.accent,
                        cursor: 'pointer',
                        fontSize: 11,
                        textDecoration: 'underline',
                        padding: 0
                      }}
                      title="Set avatar from image link"
                    >
                      (Set URL)
                    </button>
                  )}
                </div>
                {friend.status && <div style={{ fontSize: 13, color: '#B08ABD', marginTop: 1 }}>{friend.status}</div>}
                {friend.bio && <div style={{ fontSize: 13, color: 'var(--subtext)', marginTop: 4, wordBreak: 'break-word' }}>{friend.bio}</div>}
                <div style={{ fontSize: 11, color: friend.isOnline ? '#4fa865' : '#bbb', marginTop: 4 }}>
                  <><PastelIcon name={friend.isOnline ? 'online' : 'offline'} size={10} /> {friend.isOnline ? 'Online now' : 'Offline'}</>
                </div>
                {(friend._id === 'user_ai_lyra' || friend.isAI) && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setShowCharacterStudio(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        borderRadius: 16,
                        border: `1.5px solid ${friendIdentity.accent}`,
                        background: 'rgba(255, 255, 255, 0.95)',
                        color: friendIdentity.accent,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <PastelIcon name="sparkles" size={13} style={{ color: friendIdentity.accent }} />
                      {t('customizeLyra') || 'Customize Lyra'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRefreshChat}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        borderRadius: 16,
                        border: '1.5px solid var(--border)',
                        background: 'rgba(255, 255, 255, 0.95)',
                        color: 'var(--subtext)',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = friendIdentity.accent;
                        e.currentTarget.style.borderColor = friendIdentity.accent;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = 'var(--subtext)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    >
                      <PastelIcon name="refresh" size={13} />
                      {t('refreshChat') || 'Refresh Chat'}
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setProfileOpen(false)} aria-label="Close profile" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#ccc' }}><PastelIcon name="close" size={18} /></button>
            </div>
          )}

          {/* Search bar (collapsible) */}
          {searchOpen && (
            <div style={{
              background: 'var(--card-bg)',
              borderBottom: '1px solid var(--border)',
              padding: '8px 12px',
              flexShrink: 0,
              position: 'relative'
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--search-bg)', borderRadius: 20, padding: '6px 14px',
                border: '1.5px solid #DDA0DD'
              }}>
                <PastelIcon name="search" size={14} style={{ color: '#B08ABD' }} />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    background: 'transparent', fontSize: 14, color: 'var(--text)'
                  }}
                  onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#B08ABD', padding: 0 }}
                  aria-label="Clear search"><PastelIcon name="close" size={14} /></button>
                )}
              </div>

              {/* Search results dropdown */}
              {(searchResults.length > 0 || searchLoading) && (
                <div style={{
                  position: 'absolute', top: '100%', left: 12, right: 12,
                  background: 'var(--card-bg)', borderRadius: 12, zIndex: 100,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  border: '1px solid var(--border)',
                  maxHeight: 300, overflowY: 'auto'
                }}>
                  {searchLoading ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#B08ABD', fontSize: 13 }}>
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--subtext)', fontSize: 13 }}>
                      No results
                    </div>
                  ) : (
                    searchResults.map((msg) => {
                      const isOwn = (msg.senderId?._id || msg.senderId) === user?._id;
                      const senderName = isOwn ? 'You' : (friend?.name || 'Friend');
                      const q = searchQuery.trim();
                      const idx = msg.content.toLowerCase().indexOf(q.toLowerCase());
                      let preview;
                      if (idx === -1) {
                        preview = <span>{msg.content.slice(0, 60)}</span>;
                      } else {
                        const before = msg.content.slice(0, idx);
                        const match = msg.content.slice(idx, idx + q.length);
                        const after = msg.content.slice(idx + q.length, idx + q.length + 40);
                        preview = (
                          <span>
                            {before.slice(-20)}
                            <mark style={{ background: '#FFE0B2', borderRadius: 2, padding: '0 1px', color: '#4A4A4A' }}>{match}</mark>
                            {after}
                          </span>
                        );
                      }
                      return (
                        <button
                          key={msg._id}
                          onClick={() => jumpToMessage(msg._id)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            width: '100%', padding: '10px 14px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            textAlign: 'left', borderBottom: '1px solid var(--border)',
                            transition: 'background 0.15s', color: 'var(--text)'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--soft-pink)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#B08ABD' }}>{senderName}</span>
                              <span style={{ fontSize: 11, color: 'var(--subtext)' }}>{formatSearchTime(msg.timestamp)}</span>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {preview}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          <MessageList
            key={friendId}
            messages={messages}
            loading={loading}
            typingUsers={typingUsers}
            aiTyping={aiTyping}
            friend={friend}
            onReply={(msg) => setReplyingTo(msg)}
            onRecall={handleRecall}
            onReaction={handleReaction}
            onRetry={handleRetry}
            highlightId={highlightId}
            conversationIdentity={friendIdentity}
            onMessageVisible={handleMessageVisible}
            onRegenerate={handleRegenerate}
            isRegenerating={isRegenerating}
            activeSessionId={activeSessionId}
          />

          <MessageInput
            onSend={handleSend}
            to={friendId}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            disabled={loading}
            onComposerTyping={handleComposerTyping}
          />
        </div>
      </div>
      {showAIDebug && (
        <AIDebugModal onClose={() => setShowAIDebug(false)} onRefreshChat={fetchMessages} />
      )}
      {showCharacterStudio && (
        <CharacterStudioModal
          open={showCharacterStudio}
          onClose={() => setShowCharacterStudio(false)}
          friend={friend}
          friendId={friendId}
          onSaved={() => {
            fetchMessages(true);
          }}
        />
      )}
      <RefreshChatModal
        open={refreshModalOpen}
        onClose={() => !refreshLoading && setRefreshModalOpen(false)}
        onClear={handleRefreshClear}
        onKeep={handleRefreshKeep}
        loading={refreshLoading}
      />
    </div>
  );
};

export default Chat;
