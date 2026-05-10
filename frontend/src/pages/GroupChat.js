import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLang } from '../i18n';
import api from '../services/api';
import Header from '../components/Header';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';

const isMobile = () => window.innerWidth <= 700;

const GroupChat = () => {
  const { groupId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { t } = useLang();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showInfo, setShowInfo] = useState(!isMobile());
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteId, setInviteId] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const typingRef = useRef({});

  const loadGroup = useCallback(async () => {
    try {
      const { data } = await api.get(`/groups/${groupId}`);
      setGroup(data);
    } catch {
      navigate('/friends');
    }
  }, [groupId, navigate]);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/groups/${groupId}/messages?limit=80`);
      setMessages(data);
    } catch (e) {
      console.error('Failed to load group messages', e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadGroup(); fetchMessages(); }, [loadGroup, fetchMessages]);

  // Socket
  useEffect(() => {
    if (!socket || !user) return;

    const onMsg = (msg) => {
      setMessages(prev => {
        if (prev.find(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };
    const onRecall = ({ messageId }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, isRecalled: true, content: 'This message has been recalled' } : m
      ));
    };
    const onReaction = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
    };
    const onGroupUpdated = (updatedGroup) => setGroup(updatedGroup);
    const onTyping = ({ from, isTyping }) => {
      if (!from || from._id === user._id) return;
      clearTimeout(typingRef.current[from._id]);
      if (isTyping) {
        setTypingUsers(prev => prev.find(u => u.userId === from._id) ? prev : [...prev, { userId: from._id, name: from.name, avatar: from.avatar }]);
        typingRef.current[from._id] = setTimeout(() => setTypingUsers(prev => prev.filter(u => u.userId !== from._id)), 4000);
      } else {
        setTypingUsers(prev => prev.filter(u => u.userId !== from._id));
      }
    };

    socket.on(`msg:group:${groupId}:${user._id}`, onMsg);
    socket.on(`msg_recall:group:${groupId}:${user._id}`, onRecall);
    socket.on(`msg_reaction:group:${groupId}:${user._id}`, onReaction);
    socket.on(`group:updated:${groupId}`, onGroupUpdated);
    socket.on(`typing:group:${groupId}:${user._id}`, onTyping);

    return () => {
      socket.off(`msg:group:${groupId}:${user._id}`, onMsg);
      socket.off(`msg_recall:group:${groupId}:${user._id}`, onRecall);
      socket.off(`msg_reaction:group:${groupId}:${user._id}`, onReaction);
      socket.off(`group:updated:${groupId}`, onGroupUpdated);
      socket.off(`typing:group:${groupId}:${user._id}`, onTyping);
    };
  }, [socket, user, groupId]);

  const handleSend = async (content, media) => {
    await api.post(`/groups/${groupId}/messages`, { content, media });
  };

  const handleRecall = (messageId) => {
    setMessages(prev => prev.map(m =>
      m._id === messageId ? { ...m, isRecalled: true, content: 'This message has been recalled' } : m
    ));
  };

  const handleReaction = (messageId, reactions) => {
    setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
  };

  const handleLeave = async () => {
    if (!window.confirm(t('groupLeaveConfirm'))) return;
    await api.delete(`/groups/${groupId}/leave`);
    navigate('/friends');
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteId.trim()) return;
    setInviteBusy(true);
    try {
      const { data } = await api.post(`/groups/${groupId}/invite`, { userId: inviteId.trim() });
      setGroup(data);
      setInviteId('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to invite');
    } finally {
      setInviteBusy(false);
    }
  };

  // Search (client-side filter for group messages)
  const searchResults = searchQuery.trim()
    ? messages.filter(m => !m.isRecalled && m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const jumpToMessage = (msgId) => {
    setSearchOpen(false);
    setHighlightId(msgId);
    setTimeout(() => {
      document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    setTimeout(() => setHighlightId(null), 2500);
  };

  const groupAvatar = (name) => {
    const colors = ['#FFB6C1', '#DDA0DD', '#ADD8E6', '#98FB98', '#FFDAB9'];
    const idx = (name || '').charCodeAt(0) % colors.length;
    return colors[idx];
  };

  if (!group) return null;
  const isCreator = group.creatorId === user?._id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--cream)' }}>
      <Header />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main chat */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '6px 12px',
            borderBottom: '1px solid var(--border)', background: 'var(--card-bg)', gap: 8, flexShrink: 0
          }}>
            {/* Group avatar + name */}
            <div
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: groupAvatar(group.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 16, color: 'white', cursor: 'pointer'
              }}
              onClick={() => setShowInfo(v => !v)}
              title={t('groupInfo')}
            >
              {group.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setShowInfo(v => !v)}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {group.name}
              </div>
              <div style={{ fontSize: 11, color: '#B08ABD' }}>
                {group.members?.length} {t('groupMembers')}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => setSearchOpen(v => !v)}
                title="Search"
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: searchOpen ? 'linear-gradient(135deg,#FFB6C1,#DDA0DD)' : '#F7F0FA',
                  border: 'none', cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >🔍</button>
              <button
                onClick={() => setShowInfo(v => !v)}
                title={t('groupInfo')}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: showInfo ? 'linear-gradient(135deg,#FFB6C1,#DDA0DD)' : '#F7F0FA',
                  border: 'none', cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >👥</button>
            </div>
          </div>

          {/* Search bar */}
          {searchOpen && (
            <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '8px 12px', flexShrink: 0, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--search-bg)', borderRadius: 20, padding: '6px 14px', border: '1.5px solid #DDA0DD' }}>
                <span style={{ fontSize: 14, color: '#B08ABD' }}>🔍</span>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('chatSearchPlaceholder')}
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text)' }}
                  onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
                  autoFocus
                />
                {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#B08ABD', padding: 0 }}>✕</button>}
              </div>
              {searchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 12, right: 12, background: 'var(--card-bg)', borderRadius: 12, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', border: '1px solid var(--border)', maxHeight: 280, overflowY: 'auto' }}>
                  {searchResults.map(msg => {
                    const isOwn = (msg.senderId?._id || msg.senderId) === user?._id;
                    const senderName = isOwn ? t('you') : (msg.senderId?.name || '');
                    return (
                      <button key={msg._id} onClick={() => jumpToMessage(msg._id)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--soft-pink)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#B08ABD' }}>{senderName}</span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.content}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <MessageList
            messages={messages}
            loading={loading}
            typingUsers={typingUsers}
            onReply={msg => setReplyingTo(msg)}
            onRecall={handleRecall}
            onReaction={handleReaction}
            highlightId={highlightId}
            isGroup
          />

          <MessageInput
            onSend={handleSend}
            to={groupId}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            disabled={loading}
            placeholder={t('groupTypeMessage')}
          />
        </div>

        {/* Group info panel */}
        {showInfo && (
          <div style={{
            width: isMobile() ? '100%' : 240, flexShrink: 0,
            background: 'var(--card-bg)', borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            position: isMobile() ? 'absolute' : 'relative',
            top: 0, right: 0, bottom: 0, zIndex: isMobile() ? 30 : 'auto'
          }}>
            {isMobile() && (
              <button onClick={() => setShowInfo(false)} style={{ margin: '8px 12px 0', padding: '6px 12px', background: '#F7F0FA', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                ✕ {t('close')}
              </button>
            )}

            {/* Group avatar */}
            <div style={{ padding: '20px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: groupAvatar(group.name),
                margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 28, color: 'white'
              }}>
                {group.name[0]?.toUpperCase()}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{group.name}</div>
              <div style={{ fontSize: 12, color: '#B08ABD', marginTop: 2 }}>{group.members?.length} {t('groupMembers')}</div>
            </div>

            {/* Members list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--subtext)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {t('groupMembers')}
              </div>
              {group.members?.map(m => (
                <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px' }}>
                  <img src={m.avatar} alt={m.name} style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m._id === user?._id ? t('you') : m.name}
                    </div>
                    {m._id === group.creatorId && (
                      <div style={{ fontSize: 11, color: '#DDA0DD' }}>Admin</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Invite by user ID */}
            {isCreator && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                <form onSubmit={handleInvite} style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={inviteId}
                    onChange={e => setInviteId(e.target.value)}
                    placeholder="User ID..."
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 12, outline: 'none', background: 'var(--search-bg)', color: 'var(--text)' }}
                  />
                  <button type="submit" disabled={inviteBusy} style={{ padding: '6px 10px', background: 'linear-gradient(135deg,#FFB6C1,#DDA0DD)', border: 'none', borderRadius: 10, color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    {t('groupInvite')}
                  </button>
                </form>
              </div>
            )}

            {/* Leave */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={handleLeave}
                style={{ width: '100%', padding: '8px', background: '#FFF5F5', border: '1px solid #FFCDD2', borderRadius: 10, color: '#e57373', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                🚪 {t('groupLeave')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupChat;
