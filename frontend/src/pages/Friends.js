import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const Friends = () => {
  const { user } = useAuth();
  const { onlineUsers, socket } = useSocket();
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => { loadFriends(); loadRequests(); }, [loadFriends, loadRequests]);

  useEffect(() => {
    if (!socket || !user) return;
    const handler = (payload) => {
      if (payload.type === 'friend_added' || payload.type === 'friend_accepted') loadFriends();
      if (payload.type === 'friend_requested') loadRequests();
    };
    socket.on(`notify:${user._id}`, handler);
    return () => socket.off(`notify:${user._id}`, handler);
  }, [socket, user, loadFriends, loadRequests]);

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
    } catch (err) {
      setError('Accept failed');
    }
  };

  const handleDecline = async (reqId) => {
    try {
      await api.post(`/friends/decline/${reqId}`);
      loadRequests();
    } catch (err) {
      setError('Decline failed');
    }
  };

  const handleRemove = async (friendId) => {
    if (!window.confirm('Remove this friend?')) return;
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

  const isOnline = (id) => onlineUsers.some(u => u._id === id);

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>← Back</button>
      <h2 style={{ margin: '4px 0 14px' }}>💬 Your friends</h2>

      {requests.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>📫 Pending Requests</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {requests.map(r => (
              <div key={r._id} className="friend-tile pop-in" style={{ cursor: 'default' }}>
                <img className="avatar" src={r.avatar} alt="" />
                <div style={{ flex: 1 }}>
                  <p className="name">{r.name}</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => handleAccept(r._id)}>Accept</button>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => handleDecline(r._id)}>Decline</button>
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
            placeholder="Find by name..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn" type="submit">Search</button>
        </form>
        {error && <p style={{ color: '#e57373', fontSize: 13, marginTop: 10 }}>{error}</p>}
        {results.length > 0 && (
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            {results.map(u => (
              <div key={u._id} className="friend-tile pop-in" style={{ cursor: 'default' }}>
                <img className="avatar" src={u.avatar} alt="" />
                <div style={{ flex: 1 }}>
                  <p className="name">{u.name}</p>
                  <p className="sub">{isOnline(u._id) ? '🟢 Online' : '⚪ Offline'}</p>
                </div>
                <button className="btn" disabled={busy} onClick={() => handleRequest(u._id)}>＋ Request</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {friends.length === 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#888' }}>No friends yet. Search above to add someone ✿</p>
        </div>
      )}

      <div className="friend-list">
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
    </div>
  );
};

export default Friends;
