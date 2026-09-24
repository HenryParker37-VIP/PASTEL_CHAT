import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLang } from '../i18n';
import PastelIcon from '../components/PastelIcon';
import { useConfirm, useToast } from '../components/Toast';
import { getPastelIdentity } from '../utils/pastelIdentity';
import { resolveCharacterAvatar } from '../utils/characterAvatar';
import {
  getCachedFriends,
  setCachedFriends,
  getCachedRequests,
  setCachedRequests,
  getCachedGroups,
  setCachedGroups,
  mergeFriends
} from '../utils/friendsCache';

const Friends = () => {
  const { user } = useAuth();
  const { onlineUsers, socket, lyraAvatar } = useSocket();
  const navigate = useNavigate();
  const { t } = useLang();
  const { push } = useToast();
  const { confirm } = useConfirm();
  const [friends, setFriends] = useState(() => getCachedFriends(user?._id) || []);
  const [requests, setRequests] = useState(() => getCachedRequests(user?._id) || []);
  const [groups, setGroups] = useState(() => getCachedGroups(user?._id) || []);
  const [loadingFriends, setLoadingFriends] = useState(() => !(getCachedFriends(user?._id)?.length > 0));
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false);
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
      const raw = Array.isArray(data) ? data : (Array.isArray(data?.friends) ? data.friends : []);
      setFriends((prev) => {
        const merged = mergeFriends(prev, raw);
        if (user?._id) setCachedFriends(user._id, merged);
        return merged;
      });
      setHasLoadedFromServer(true);
    } catch {
      // Retain cached friends on failure
      setHasLoadedFromServer(true);
    } finally {
      setLoadingFriends(false);
    }
  }, [user?._id]);

  const loadRequests = useCallback(async () => {
    try {
      const { data } = await api.get('/friends/requests');
      const raw = Array.isArray(data) ? data : (Array.isArray(data?.requests) ? data.requests : []);
      setRequests(raw);
      if (user?._id) setCachedRequests(user._id, raw);
    } catch {
      // Retain cached requests on failure
    }
  }, [user?._id]);

  const loadGroups = useCallback(async () => {
    try {
      const { data } = await api.get('/groups');
      const raw = Array.isArray(data) ? data : (Array.isArray(data?.groups) ? data.groups : []);
      setGroups(raw);
      if (user?._id) setCachedGroups(user._id, raw);
    } catch {
      // Retain cached groups on failure
    }
  }, [user?._id]);

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
      const rawResults = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
      setResults(rawResults.filter(u => u && u._id !== user?._id));
    } catch {
      setResults([]);
    }
  };

  const handleRequest = async (targetId) => {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/friends/request', { friendId: targetId });
      setResults((current) => (Array.isArray(current) ? current : []).map((result) => (
        result?._id === targetId
          ? { ...result, relationship: data?.autoAccepted ? { status: 'friends' } : { status: 'outgoing', requestId: data?._id } }
          : result
      )));
      if (data?.autoAccepted) {
        loadFriends();
        loadRequests();
        push({ icon: 'users', title: t('feedbackFriendRequestAccepted') || 'Connected as friends!', tone: 'success' });
      } else {
        push({ icon: 'users', title: t('feedbackFriendRequestSent'), tone: 'success' });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send request');
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async (reqId) => {
    setError('');
    try {
      await api.post(`/friends/accept/${reqId}`);
      loadRequests();
      loadFriends();
      setResults((current) => (Array.isArray(current) ? current : []).map((result) => (
        result?.relationship?.requestId === reqId ? { ...result, relationship: { status: 'friends' } } : result
      )));
      push({ icon: 'check', title: t('feedbackFriendRequestAccepted'), tone: 'success' });
    } catch (err) {
      loadRequests();
      loadFriends();
      const msg = err.response?.data?.message || t('feedbackSomethingWrong');
      setError(msg);
      push({ icon: 'alert', title: msg, tone: 'error' });
    }
  };

  const handleDecline = async (reqId) => {
    setError('');
    try {
      await api.post(`/friends/decline/${reqId}`);
      loadRequests();
      push({ icon: 'check', title: t('feedbackFriendRequestDeclined'), tone: 'info' });
    } catch (err) {
      loadRequests();
      const msg = err.response?.data?.message || t('feedbackSomethingWrong');
      setError(msg);
      push({ icon: 'alert', title: msg, tone: 'error' });
    }
  };

  const handleRemove = async (friendId) => {
    const accepted = await confirm({ title: t('friendsRemoveTitle'), message: t('friendsRemove'), confirmLabel: t('friendsRemove'), tone: 'danger', icon: 'trash' });
    if (!accepted) return;
    setFriends((prev) => {
      const updated = prev.filter((f) => f.friendId !== friendId);
      if (user?._id) setCachedFriends(user._id, updated);
      return updated;
    });
    try {
      await api.delete(`/friends/${friendId}`);
      push({ icon: 'check', title: t('feedbackFriendRemoved'), tone: 'success' });
    } catch {
      loadFriends();
      push({ icon: 'alert', title: t('feedbackSomethingWrong'), tone: 'error' });
    }
  };

  const saveNickname = async (friendId) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setFriends((prev) => {
      const updated = prev.map((f) => (f.friendId === friendId ? { ...f, customNickname: trimmed } : f));
      if (user?._id) setCachedFriends(user._id, updated);
      return updated;
    });
    setEditingId(null);
    setEditValue('');
    try {
      await api.put(`/friends/${friendId}`, { customNickname: trimmed });
    } catch {
      loadFriends();
    }
  };

  const toggleMember = (friendId) => {
    setSelectedMembers(prev =>
      (Array.isArray(prev) ? prev : []).includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...(Array.isArray(prev) ? prev : []), friendId]
    );
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setCreatingGroup(true);
    try {
      const { data } = await api.post('/groups', { name: groupName.trim(), memberIds: selectedMembers });
      setGroups(prev => [data, ...(Array.isArray(prev) ? prev : [])]);
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

  const isOnline = (id) => (Array.isArray(onlineUsers) ? onlineUsers : []).some(u => u && u._id === id);

  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeRequests = Array.isArray(requests) ? requests : [];
  const safeGroups = Array.isArray(groups) ? groups : [];
  const safeResults = Array.isArray(results) ? results : [];
  const relationshipAction = (result) => {
    const relationship = result?.relationship || { status: 'none' };
    if (relationship.status === 'friends') return { label: t('friendsAlreadyFriends'), disabled: true };
    if (relationship.status === 'outgoing') return { label: t('friendsRequestSent'), disabled: true };
    if (relationship.status === 'incoming') {
      return { label: t('friendsAccept'), onClick: () => handleAccept(relationship.requestId) };
    }
    return { label: t('friendsAdd'), onClick: () => handleRequest(result._id), disabled: busy };
  };

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>
        {t('back')}
      </button>
      <h2 style={{ margin: '4px 0 14px' }}>{t('friendsTitle')}</h2>

      {safeRequests.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{t('friendsPending')}</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {safeRequests.map(r => (
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
        {safeResults.length > 0 && (
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            {safeResults.map(u => (
              <div key={u._id} className="friend-tile pop-in" style={{ cursor: 'default' }}>
                <img className="avatar" src={u.avatar} alt="" />
                <div style={{ flex: 1 }}>
                  <p className="name">{u.name}</p>
                  <p className="sub"><PastelIcon name={isOnline(u._id) ? 'online' : 'offline'} size={10} /> {isOnline(u._id) ? t('online') : t('offline')}</p>
                </div>
                {(() => {
                  const action = relationshipAction(u);
                  return <button className="btn" disabled={action.disabled} onClick={action.onClick}>{action.label}</button>;
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {loadingFriends && safeFriends.length === 0 && (
        <div className="friend-list" style={{ marginBottom: 28 }} aria-label="Loading friends">
          {[1, 2].map((n) => (
            <div key={n} className="friend-tile" style={{ opacity: 0.6, pointerEvents: 'none' }}>
              <div className="avatar" style={{ background: '#f0e6f6', borderRadius: '50%', width: 44, height: 44 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ background: '#f0e6f6', width: '40%', height: 16, borderRadius: 4 }} />
                <div style={{ background: '#f8f4fa', width: '25%', height: 12, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loadingFriends && hasLoadedFromServer && safeFriends.length === 0 && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 20 }}>
          <p style={{ margin: 0, color: '#888' }}>{t('friendsNoFriends')}</p>
        </div>
      )}

      <div className="friend-list" style={{ marginBottom: 28 }}>
        {safeFriends.map(f => (
          <div key={f.friendId} className="friend-tile pop-in" style={{ boxShadow: `inset 3px 0 0 ${getPastelIdentity(f.friendId).accent}` }}>
            <img
              className="avatar"
              src={resolveCharacterAvatar({ friend: f, friendId: f.friendId, userId: user?._id, avatarOverride: lyraAvatar }) || f.avatar}
              alt=""
              style={{ border: `2px solid ${getPastelIdentity(f.friendId).accent}`, objectFit: 'cover' }}
              onClick={() => navigate(`/chat/${f.friendId}`)}
            />
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
                <p className="name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {f.customNickname}
                </p>
              )}
              <p className="sub">
                <span className={`dot ${(isOnline(f.friendId) || f.isAI || f.friendId === 'user_ai_lyra') ? 'online' : ''}`} />
                {f.bio ? f.bio : `${f.realName} ${f.realName !== f.customNickname ? `(${f.realName})` : ''}`}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                className="btn btn-lavender"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={(e) => { e.stopPropagation(); setEditingId(f.friendId); setEditValue(f.customNickname); }}
              aria-label="Edit nickname"><PastelIcon name="edit" size={14} /></button>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={(e) => { e.stopPropagation(); handleRemove(f.friendId); }}
              aria-label="Remove friend"><PastelIcon name="close" size={14} /></button>
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

      {safeGroups.length === 0 && !showCreateGroup && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#888' }}>{t('friendsNoGroups')}</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {safeGroups.map(g => (
          <div
            key={g._id}
            className="friend-tile pop-in"
            style={{ cursor: 'pointer', boxShadow: `inset 3px 0 0 ${getPastelIdentity(g._id).accent}` }}
            onClick={() => navigate(`/group/${g._id}`)}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: getPastelIdentity(g._id).soft,
              color: getPastelIdentity(g._id).accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0
            }}><PastelIcon name="users" size={20} title="Group" /></div>
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
            <h3 style={{ margin: '0 0 20px', fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><PastelIcon name="users" size={20} /> {t('friendsCreateGroup')}</h3>
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

              {safeFriends.length > 0 && (
                <>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#888', display: 'block', marginBottom: 10 }}>
                    {t('friendsAddMembers')}
                  </label>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                    {safeFriends.map(f => (
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
                        <img src={f.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
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
                  {creatingGroup ? t('saving') : <><PastelIcon name="users" size={16} /> {t('friendsCreateGroup')}</>}
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
