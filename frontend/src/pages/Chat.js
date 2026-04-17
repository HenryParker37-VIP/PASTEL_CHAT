import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';
import Header from '../components/Header';
import OnlineUsers from '../components/OnlineUsers';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';

const Chat = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const typingRef = useRef({});

  // Fetch message history
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/messages?limit=80');
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg) => {
      setMessages((prev) => {
        // Avoid duplicates
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

    const onTyping = ({ userId, name, avatar, isTyping }) => {
      if (userId === user?._id) return;

      // Manage per-user typing timeout
      clearTimeout(typingRef.current[userId]);

      if (isTyping) {
        setTypingUsers((prev) => {
          if (prev.find((u) => u.userId === userId)) return prev;
          return [...prev, { userId, name, avatar }];
        });
        typingRef.current[userId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
        }, 4000);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
      }
    };

    socket.on('message_received', onMessage);
    socket.on('message_recalled', onRecall);
    socket.on('user_typing', onTyping);

    return () => {
      socket.off('message_received', onMessage);
      socket.off('message_recalled', onRecall);
      socket.off('user_typing', onTyping);
    };
  }, [socket, user]);

  const handleSend = async (content) => {
    try {
      if (replyingTo) {
        await api.post(`/messages/${replyingTo._id}/reply`, { content });
        setReplyingTo(null);
      } else {
        await api.post('/messages', { content });
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

  const handleReply = (message) => {
    setReplyingTo(message);
  };

  const handleCancelReply = () => setReplyingTo(null);

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
        {/* Sidebar — online users */}
        {sidebarOpen && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '220px',
            flexShrink: 0,
            overflow: 'hidden'
          }}>
            <OnlineUsers />
          </div>
        )}

        {/* Main chat area */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar toggle */}
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
                cursor: 'pointer', transition: 'all 0.15s'
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
            <span style={{ fontSize: '13px', color: '#4A4A4A', fontWeight: 500 }}>
              General Chat
            </span>
          </div>

          <MessageList
            messages={messages}
            loading={loading}
            typingUsers={typingUsers}
            onReply={handleReply}
            onRecall={handleRecall}
          />

          <MessageInput
            onSend={handleSend}
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;
