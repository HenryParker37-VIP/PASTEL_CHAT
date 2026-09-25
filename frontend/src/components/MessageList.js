import React, { useEffect, useLayoutEffect, useRef } from 'react';
import MessageItem from './MessageItem';
import LoadingAnimation from './LoadingAnimation';
import TypingIndicator from './TypingIndicator';
import PastelIcon from './PastelIcon';
import { useLang } from '../i18n';

const MessageList = ({
  messages = [],
  loading,
  typingUsers = [],
  aiTyping = null,
  friend = null,
  onReply,
  onRecall,
  onReaction,
  onRetry,
  highlightId,
  conversationIdentity,
  onMessageVisible,
  onRegenerate,
  isRegenerating = false
}) => {
  const { t } = useLang();
  const containerRef = useRef(null);
  const initialPositionedRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const nearBottomRef = useRef(true);
  const safeMessages = (Array.isArray(messages) ? messages : []).filter((m) => !m.isSuperseded);

  const isNearBottom = (container) => (
    container.scrollHeight - container.scrollTop - container.clientHeight < 80
  );

  // Position the first rendered batch before the browser paints. This avoids
  // showing the top of a conversation and then visibly scrolling to the end.
  useLayoutEffect(() => {
    if (loading || initialPositionedRef.current || !containerRef.current) return;

    containerRef.current.scrollTop = containerRef.current.scrollHeight;
    previousMessageCountRef.current = safeMessages.length;
    initialPositionedRef.current = true;
  }, [loading, safeMessages.length]);

  // Keep the normal live-chat behavior for messages that arrive after the
  // initial batch, but only when the user was already near the bottom.
  useEffect(() => {
    if (!initialPositionedRef.current || safeMessages.length <= previousMessageCountRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    previousMessageCountRef.current = safeMessages.length;
    if (distanceFromBottom < 80) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [safeMessages.length]);

  // Keep bottom anchor when AI typing indicator appears
  useEffect(() => {
    if (!initialPositionedRef.current || !nearBottomRef.current || !aiTyping?.isTyping) return;
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [aiTyping?.isTyping]);

  // The flex layout reduces this container when the iPhone keyboard opens.
  // Re-anchor only if the user was already reading the bottom; never move a
  // user who intentionally scrolled upward.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const keepBottomAfterResize = () => {
      if (initialPositionedRef.current && nearBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    };
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(keepBottomAfterResize)
      : null;
    resizeObserver?.observe(container);

    const visualViewport = window.visualViewport;
    const handleViewportResize = () => {
      if (!initialPositionedRef.current || !nearBottomRef.current) return;
      window.requestAnimationFrame(keepBottomAfterResize);
    };
    visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
      resizeObserver?.disconnect();
      visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  // A read receipt is driven by actual intersection with the visible message
  // area, not merely by rendering the message somewhere in the DOM.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || loading || typeof IntersectionObserver !== 'function' || !onMessageVisible) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          const message = messages.find((item) => item._id === entry.target.id.replace('msg-', ''));
          if (message) onMessageVisible(message);
        }
      });
    }, { root: container, threshold: [0.6] });
    messages.forEach((message) => {
      const element = container.querySelector(`#msg-${CSS.escape(String(message._id))}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [loading, messages, onMessageVisible]);

  // Images and other media can increase scrollHeight after the initial
  // layout. Preserve the bottom position when the user was already there.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const keepBottomOnAssetLoad = () => {
      if (!initialPositionedRef.current) return;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 80) container.scrollTop = container.scrollHeight;
    };

    container.addEventListener('load', keepBottomOnAssetLoad, true);
    return () => container.removeEventListener('load', keepBottomOnAssetLoad, true);
  }, []);

  const groupByDate = (msgs) => {
    const groups = [];
    let lastDate = null;
    (Array.isArray(msgs) ? msgs : []).forEach((msg) => {
      if (!msg) return;
      const d = new Date(msg.timestamp || Date.now()).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      if (d !== lastDate) {
        groups.push({ type: 'dateSeparator', label: d, id: `sep-${d}` });
        lastDate = d;
      }
      groups.push({ type: 'message', data: msg, id: msg._id || msg.clientMessageId || `tmp-${Math.random()}` });
    });
    return groups;
  };

  const isAiFriend = Boolean(friend && (friend.isAI || friend._id === 'user_ai_lyra'));

  // Identify latest AI response group when communicating with Lyra
  let latestAiBubbleIds = new Set();
  let lastAiBubbleId = null;
  let triggeringUserMessageId = null;

  if (isAiFriend && safeMessages.length > 0) {
    const reversed = [...safeMessages].map((m, i) => ({ m, i })).reverse();
    const lastUserEntry = reversed.find(({ m }) => {
      const sId = m.senderId?._id || m.senderId;
      return sId !== 'user_ai_lyra' && !m.isSessionBoundary && !m.isSuperseded;
    });

    if (lastUserEntry) {
      triggeringUserMessageId = lastUserEntry.m._id;
      const subsequentAiMsgs = safeMessages.slice(lastUserEntry.i + 1).filter(m => {
        const sId = m.senderId?._id || m.senderId;
        return (sId === 'user_ai_lyra' || (friend && friend.isAI)) && !m.isSessionBoundary && !m.isSuperseded;
      });

      if (subsequentAiMsgs.length > 0) {
        latestAiBubbleIds = new Set(subsequentAiMsgs.map(m => m._id));
        lastAiBubbleId = subsequentAiMsgs[subsequentAiMsgs.length - 1]._id;
      }
    }
  }

  const items = groupByDate(safeMessages);

  return (
    <div
      ref={containerRef}
      onScroll={(event) => {
        nearBottomRef.current = isNearBottom(event.currentTarget);
      }}
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        padding: '12px 0',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--cream)'
      }}
    >
      {loading && safeMessages.length === 0 && <LoadingAnimation />}

      {!loading && safeMessages.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '80px',
          gap: '12px',
          color: '#CCCCCC'
        }}>
          <PastelIcon name="chat-friends" size={48} />
          <p style={{ fontSize: '15px', fontWeight: 500 }}>No messages yet</p>
          <p style={{ fontSize: '13px' }}>Be the first to say hello!</p>
        </div>
      )}

      {items.map((item) => {
        if (item.type === 'dateSeparator') {
          return (
            <div key={item.id} className="date-pill" style={{ userSelect: 'none' }}>
              <span>{item.label}</span>
            </div>
          );
        }

        if (item.data.isSessionBoundary) {
          return (
            <div key={item.id} className="session-divider-pill" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '16px 0',
              userSelect: 'none'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 14px',
                borderRadius: '16px',
                background: 'rgba(181, 234, 215, 0.35)',
                border: '1px solid rgba(181, 234, 215, 0.65)',
                fontSize: '11.5px',
                fontWeight: 600,
                color: '#3d6352',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
              }}>
                <span>🌱 {t ? t('newConversationDivider') : 'New conversation'}</span>
              </div>
            </div>
          );
        }

        const isLatestAiGroup = latestAiBubbleIds.has(item.data._id);
        const isLastOfAiTurn = item.data._id === lastAiBubbleId;
        const canRegenerate = isAiFriend && isLatestAiGroup && !aiTyping?.isTyping;

        return (
          <MessageItem
            key={item.id}
            message={item.data}
            peer={friend}
            onReply={onReply}
            onRecall={onRecall}
            onReaction={onReaction}
            onRetry={onRetry}
            highlight={highlightId === item.id}
            conversationIdentity={conversationIdentity}
            canRegenerate={canRegenerate}
            isLastOfAiTurn={isLastOfAiTurn}
            isRegenerating={isRegenerating}
            onRegenerate={() => onRegenerate?.(triggeringUserMessageId)}
          />
        );
      })}

      <TypingIndicator
        typingUsers={typingUsers}
        aiTyping={aiTyping}
        friend={friend}
        messages={safeMessages}
        conversationIdentity={conversationIdentity}
      />

      <div style={{ height: '4px' }} />
    </div>
  );
};

export default MessageList;
