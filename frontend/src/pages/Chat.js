import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useCall } from '../contexts/CallContext';
import api from '../services/api';
import Header from '../components/Header';
import OnlineUsers from '../components/OnlineUsers';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';

const isMobile = () => window.innerWidth <= 700;

const Chat = () => {
  const { friendId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { startCall, activeCall } = useCall();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());
  const typingRef = useRef({});

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
      .then(({ data }) => setFriend(data))
      .catch(() => navigate('/friends'));
  }, [friendId, navigate]);

  // Fetch message history
  const fetchMessages = useCallback(async () => {
    if (!friendId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/messages/with/${friendId}?limit=80`);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err.message);
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Socket listeners — scoped to this conversation
  useEffect(() => {
    if (!socket || !friendId || !user) return;

    const roomKey = `${user._id}:${friendId}`;
    const reverseKey = `${friendId}:${user._id}`;

    const onMessage = (msg) => {
      setMessages((prev) => {
        if (prev.find((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
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

    socket.on(`msg:${roomKey}`, onMessage);
    socket.on(`msg:${reverseKey}`, onMessage);
    socket.on(`msg_recall:${roomKey}`, onRecall);
    socket.on(`msg_recall:${reverseKey}`, onRecall);
    socket.on(`msg_reaction:${roomKey}`, onReaction);
    socket.on(`msg_reaction:${reverseKey}`, onReaction);
    socket.on(`typing:${user._id}`, onTyping);

    return () => {
      socket.off(`msg:${roomKey}`, onMessage);
      socket.off(`msg:${reverseKey}`, onMessage);
      socket.off(`msg_recall:${roomKey}`, onRecall);
      socket.off(`msg_recall:${reverseKey}`, onRecall);
      socket.off(`msg_reaction:${roomKey}`, onReaction);
      socket.off(`msg_reaction:${reverseKey}`, onReaction);
      socket.off(`typing:${user._id}`, onTyping);
    };
  }, [socket, friendId, user]);

  // Collapse sidebar on resize to mobile
  useEffect(() => {
    const onResize = () => { if (isMobile()) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
        setSearchResults(data);
      } catch (e) {
        console.error('Search failed:', e);
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

  const handleSend = async (content, media) => {
    try {
      if (replyingTo) {
        await api.post(`/messages/${replyingTo._id}/reply`, { content });
        setReplyingTo(null);
      } else {
        await api.post('/messages', { receiverId: friendId, content, media });
      }
    } catch (err) {
      console.error('Send failed:', err.message);
      throw err;
    }
  };

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

  const formatSearchTime = (ts) =>
    new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--cream)'
    }}>
      <Header />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{
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
                ✕ Close
              </button>
            )}
            <OnlineUsers />
          </div>
        )}

        {/* Main chat area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0, position: 'relative' }}>
          {/* Toolbar */}
          <div style={{
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

            {friend && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                {/* Clickable avatar — opens profile card */}
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                  title="View profile"
                >
                  <img
                    src={friend.avatar}
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: '50%', display: 'block' }}
                  />
                </button>
                <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => setProfileOpen(v => !v)}>
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'block'
                  }}>
                    {friend.name}
                  </span>
                  <span style={{ fontSize: 11, color: friend.status ? '#B08ABD' : (friend.isOnline ? '#4fa865' : '#bbb') }}>
                    {friend.status || (friend.isOnline ? 'Online' : 'Offline')}
                  </span>
                </div>

                {/* Action buttons */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
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
                  >🔍</button>

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
                  >📞</button>
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
                  >📹</button>
                </div>
              </div>
            )}
          </div>

          {/* Friend profile card (collapsible) */}
          {profileOpen && friend && (
            <div style={{
              background: 'var(--card-bg)', borderBottom: '1px solid var(--border)',
              padding: '14px 16px', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 14
            }}>
              <img src={friend.avatar} alt="" style={{ width: 52, height: 52, borderRadius: '50%' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{friend.name}</div>
                {friend.status && <div style={{ fontSize: 13, color: '#B08ABD', marginTop: 1 }}>{friend.status}</div>}
                {friend.bio && <div style={{ fontSize: 13, color: 'var(--subtext)', marginTop: 4, wordBreak: 'break-word' }}>{friend.bio}</div>}
                <div style={{ fontSize: 11, color: friend.isOnline ? '#4fa865' : '#bbb', marginTop: 4 }}>
                  {friend.isOnline ? '🟢 Online now' : '⚫ Offline'}
                </div>
              </div>
              <button onClick={() => setProfileOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#ccc' }}>✕</button>
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
                <span style={{ fontSize: 14, color: '#B08ABD' }}>🔍</span>
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
                  >✕</button>
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
            messages={messages}
            loading={loading}
            typingUsers={typingUsers}
            onReply={(msg) => setReplyingTo(msg)}
            onRecall={handleRecall}
            onReaction={handleReaction}
            highlightId={highlightId}
          />

          <MessageInput
            onSend={handleSend}
            to={friendId}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;
