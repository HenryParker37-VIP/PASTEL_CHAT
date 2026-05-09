import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLang } from '../i18n';

const Friends = () => {
  const { user } = useAuth();
  const { onlineUsers, socket } = useSocket();
  const navigate = useNavigate();
  const { t } = useLang();
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [groups, setGroups] = useState([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Group creation modal state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const loadFriends = useCallback(async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data);
    } catch {
      setFriends([]);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const { data } = await api.get('/friends/requests');
      setRequests(data);
    } catch {
      setRequests([]);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const { data } = await api.get('/groups');
      setGroups(data);
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => { loadFriends(); loadRequests(); loadGroups(); }, [loadFriends, loadRequests, loadGroups]);

  useEffect(() => {
    if (!socket || !user) return;
    const handler = (payload) => {
      if (payload.type === 'friend_added' || payload.type === 'friend_accepted') loadFriends();
      if (payload.type === 'friend_requested') loadRequests();
      if (payload.type === 'group_created' || payload.type === 'group_invited') loadGroups();
    };
    socket.on(`notify:${user._id}`, handler);
    return () => socket.off(`notify:${user._id}`, handler);
  }, [socket, user, loadFriends, loadRequests, loadGroups]);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    if (!q.trim()) return;
    try {
      const { data } = await api.get('/users/search', { params: { q: q.trim() } });
      setResults(data.filter(u => u._id !== user._id));
    } catch {
      setResults([]);
    }
  };

  const handleRequest = async (targetId) => {
    setBusy(true); setError('');
    try {
      await api.post('/friends/request', { friendId: targetId });
      setResults(r => r.filter(u => u._id !== targetId));
      alert('Friend request sent!');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send request');
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async (reqId) => {
    try {
      await api.post(`/friends/accept/${reqId}`);
      loadRequests();
      loadFriends();
    } catch {
      setError('Accept failed');
    }
  };

  const handleDecline = async (reqId) => {
    try {
      await api.post(`/friends/decline/${reqId}`);
      loadRequests();
    } catch {
      setError('Decline failed');
    }
  };

  const handleRemove = async (friendId) => {
    if (!window.confirm(t('friendsRemove'))) return;
    await api.delete(`/friends/${friendId}`);
    loadFriends();
  };

  const saveNickname = async (friendId) => {
    if (!editValue.trim()) return;
    await api.put(`/friends/${friendId}`, { customNickname: editValue.trim() });
    setEditingId(null);
    setEditValue('');
    loadFriends();
  };

  const toggleMember = (friendId) => {
    setSelectedMembers(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setCreatingGroup(true);
    try {
      const { data } = await api.post('/groups', { name: groupName.trim(), memberIds: selectedMembers });
      setGroups(prev => [data, ...prev]);
      setShowCreateGroup(false);
      setGroupName('');
      setSelectedMembers([]);
      navigate(`/group/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const isOnline = (id) => onlineUsers.some(u => u._id === id);

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>
        {t('back')}
      </button>
      <h2 style={{ margin: '4px 0 14px' }}>{t('friendsTitle')}</h2>

      {requests.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{t('friendsPending')}</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {requests.map(r => (
              <div key={r._id} className="friend-tile pop-in" style={{ cursor: 'default' }}>
                <img className="avatar" src={r.avatar} alt="" />
                <div style={{ flex: 1 }}>
                  <p className="name">{r.name}</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => handleAccept(r._id)}>{t('friendsAccept')}</button>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => handleDecline(r._id)}>{t('friendsDecline')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder={t('friendsSearchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn" type="submit">{t('search')}</button>
        </form>
        {error && <p style={{ color: '#e57373', fontSize: 13, marginTop: 10 }}>{error}</p>}
        {results.length > 0 && (
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            {results.map(u => (
              <div key={u._id} className="friend-tile pop-in" style={{ cursor: 'default' }}>
                <img className="avatar" src={u.avatar} alt="" />
                <div style={{ flex: 1 }}>
                  <p className="name">{u.name}</p>
                  <p className="sub">{isOnline(u._id) ? `🟢 ${t('online')}` : `⚪ ${t('offline')}`}</p>
                </div>
                <button className="btn" disabled={busy} onClick={() => handleRequest(u._id)}>{t('friendsRequest')}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {friends.length === 0 && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 20 }}>
          <p style={{ margin: 0, color: '#888' }}>{t('friendsNoFriends')}</p>
        </div>
      )}

      <div className="friend-list" style={{ marginBottom: 28 }}>
        {friends.map(f => (
          <div key={f.friendId} className="friend-tile pop-in">
            <img className="avatar" src={f.avatar} alt="" onClick={() => navigate(`/chat/${f.friendId}`)} />
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/chat/${f.friendId}`)}>
              {editingId === f.friendId ? (
                <input
                  className="input"
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveNickname(f.friendId)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveNickname(f.friendId); if (e.key === 'Escape') setEditingId(null); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ padding: '4px 10px', fontSize: 14 }}
                />
              ) : (
                <p className="name">{f.customNickname}</p>
              )}
              <p className="sub">
                <span className={`dot ${isOnline(f.friendId) ? 'online' : ''}`} />
                {f.realName} {f.realName !== f.customNickname && <em style={{ color: '#aaa' }}>(real name)</em>}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                className="btn btn-lavender"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={(e) => { e.stopPropagation(); setEditingId(f.friendId); setEditValue(f.customNickname); }}
              >✎</button>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={(e) => { e.stopPropagation(); handleRemove(f.friendId); }}
              >✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Groups section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{t('friendsGroups')}</h3>
        <button
          className="btn btn-lavender"
          style={{ fontSize: 13, padding: '5px 14px' }}
          onClick={() => { setShowCreateGroup(true); setError(''); }}
        >
          {t('friendsNewGroup')}
        </button>
      </div>

      {groups.length === 0 && !showCreateGroup && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#888' }}>{t('friendsNoGroups')}</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {groups.map(g => (
          <div
            key={g._id}
            className="friend-tile pop-in"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/group/${g._id}`)}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #DDA0DD, #ADD8E6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0
            }}>👥</div>
            <div style={{ flex: 1 }}>
              <p className="name">{g.name}</p>
              <p className="sub">{g.memberCount ?? g.members?.length ?? 0} {t('friendsMembers')}</p>
            </div>
            <span style={{ color: '#bbb', fontSize: 18 }}>›</span>
          </div>
        ))}
      </div>

      {/* Create group modal */}
      {showCreateGroup && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500
        }} onClick={() => setShowCreateGroup(false)}>
          <div
            style={{
              background: 'white', borderRadius: 20, padding: 28,
              width: 'min(420px, 90vw)', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>✨ {t('friendsCreateGroup')}</h3>
            <form onSubmit={handleCreateGroup}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>
                {t('friendsGroupName')}
              </label>
              <input
                className="input"
                placeholder={t('friendsGroupNamePlaceholder')}
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                style={{ marginBottom: 18 }}
                autoFocus
              />

              {friends.length > 0 && (
                <>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 10 }}>
                    {t('friendsAddMembers')}
                  </label>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                    {friends.map(f => (
                      <label
                        key={f.friendId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                          background: selectedMembers.includes(f.friendId) ? '#FFF0F5' : '#FAFAFA',
                          border: selectedMembers.includes(f.friendId) ? '1.5px solid #DDA0DD' : '1.5px solid #EEE',
                          transition: 'all 0.15s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(f.friendId)}
                          onChange={() => toggleMember(f.friendId)}
                          style={{ accentColor: '#DDA0DD' }}
                        />
                        <img src={f.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{f.customNickname}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              {error && <p style={{ color: '#e57373', fontSize: 13, marginBottom: 12 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  className="btn"
                  disabled={creatingGroup || !groupName.trim()}
                  style={{ flex: 1 }}
                >
                  {creatingGroup ? t('saving') : `✨ ${t('friendsCreateGroup')}`}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowCreateGroup(false); setGroupName(''); setSelectedMembers([]); }}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Friends;
