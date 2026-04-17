import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
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
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());
  const typingRef = useRef({});

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
    socket.on(`typing:${user._id}`, onTyping);

    return () => {
      socket.off(`msg:${roomKey}`, onMessage);
      socket.off(`msg:${reverseKey}`, onMessage);
      socket.off(`msg_recall:${roomKey}`, onRecall);
      socket.off(`msg_recall:${reverseKey}`, onRecall);
      socket.off(`typing:${user._id}`, onTyping);
    };
  }, [socket, friendId, user]);

  // Collapse sidebar on resize to mobile
  useEffect(() => {
    const onResize = () => { if (isMobile()) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleSend = async (content) => {
    try {
      if (replyingTo) {
        await api.post(`/messages/${replyingTo._id}/reply`, { content });
        setReplyingTo(null);
      } else {
        await api.post('/messages', { receiverId: friendId, content });
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: '#FFF8F3'
    }}>
      <Header />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar — only visible on desktop or when toggled open */}
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
            background: '#FFF8F3'
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

        {/* Main chat area — always full width when sidebar is closed */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
          {/* Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 12px',
            borderBottom: '1px solid #EEE0D8',
            background: 'white',
            gap: '8px',
            flexShrink: 0
          }}>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? 'Hide online users' : 'Show online users'}
              style={{
                background: 'none', border: '1px solid #EEE0D8',
                borderRadius: '8px', padding: '4px 10px',
                fontSize: '12px', color: '#AAAAAA',
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
                e.currentTarget.style.borderColor = '#EEE0D8';
                e.currentTarget.style.color = '#AAAAAA';
              }}
            >
              {sidebarOpen ? '◀ Hide' : '▶ Online'}
            </button>

            {friend && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <img
                  src={friend.avatar}
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
                />
                <span style={{
                  fontSize: 13, fontWeight: 600, color: '#4A4A4A',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {friend.name}
                </span>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: friend.isOnline ? '#7bd389' : '#ccc'
                }} />
              </div>
            )}
          </div>

          <MessageList
            messages={messages}
            loading={loading}
            typingUsers={typingUsers}
            onReply={(msg) => setReplyingTo(msg)}
            onRecall={handleRecall}
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
