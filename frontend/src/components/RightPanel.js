import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const BACKGROUNDS = [
  { id: 'cream',    label: 'Cream',    value: '#FFF8F3' },
  { id: 'pink',     label: 'Pink',     value: 'linear-gradient(135deg, #FFE4E1, #FFB6C1)' },
  { id: 'blue',     label: 'Blue',     value: 'linear-gradient(135deg, #E0F2FF, #ADD8E6)' },
  { id: 'lavender', label: 'Lavender', value: 'linear-gradient(135deg, #F3E8FF, #DDA0DD)' },
  { id: 'mint',     label: 'Mint',     value: 'linear-gradient(135deg, #E0F7F5, #B0E0E6)' },
  { id: 'sunset',   label: 'Sunset',   value: 'linear-gradient(135deg, #FFE4E1, #FFD1DC, #DDA0DD)' }
];

const RightPanel = ({ open, onClose, peer, friendId, onClearChat, onPinnedClick, onSearch, onBackgroundChange }) => {
  const { user, updateProfile } = useAuth();
  const [query, setQuery] = useState('');
  const [pinned, setPinned] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !friendId) return;
    setLoading(true);
    api.get(`/messages/pinned/${friendId}`)
      .then(({ data }) => setPinned(data))
      .catch(() => setPinned([]))
      .finally(() => setLoading(false));
  }, [open, friendId]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      const { data } = await api.get(`/messages/search/${friendId}`, { params: { q: query.trim() } });
      onSearch?.(data, query.trim());
    } catch {
      onSearch?.([], query.trim());
    }
  };

  const handleBackground = async (bg) => {
    await updateProfile({ chatBackground: bg.id });
    onBackgroundChange?.(bg);
  };

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer slide-in-right" role="dialog" aria-label="Chat options">
        <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 30 }}>
          <img className="avatar" src={user?.avatar} alt="" />
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{user?.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Your code: <code>{user?.loginCode}</code></p>
          </div>
        </div>

        {peer && (
          <>
            <h3>Chatting with</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img className="avatar" src={peer.avatar} alt="" style={{ width: 40, height: 40 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>{peer.customNickname || peer.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#888' }}>{peer.isOnline ? '🟢 Online' : '⚪ Offline'}</p>
              </div>
            </div>
          </>
        )}

        <h3>Search messages</h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6 }}>
          <input
            className="input"
            placeholder="Find in chat..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn" type="submit">Go</button>
        </form>

        <h3>📌 Pinned</h3>
        {loading && <p style={{ fontSize: 13, color: '#999' }}>Loading...</p>}
        {!loading && pinned.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>No pinned messages yet.</p>}
        {pinned.map((m) => (
          <div
            key={m._id}
            className="card pop-in"
            style={{ padding: 10, marginBottom: 8, fontSize: 13, cursor: 'pointer' }}
            onClick={() => onPinnedClick?.(m)}
          >
            <strong style={{ fontSize: 11, color: '#888' }}>{m.sender?.name}</strong>
            <p style={{ margin: '4px 0 0' }}>{m.content}</p>
          </div>
        ))}

        <h3>🎨 Chat background</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.id}
              onClick={() => handleBackground(bg)}
              className={user?.chatBackground === bg.id ? 'selected' : ''}
              style={{
                height: 54,
                borderRadius: 12,
                background: bg.value,
                border: user?.chatBackground === bg.id ? '3px solid var(--pink)' : '3px solid transparent',
                fontSize: 11,
                color: '#555'
              }}
            >
              {bg.label}
            </button>
          ))}
        </div>

        <h3>⚠️ Danger zone</h3>
        <button
          className="btn"
          style={{ width: '100%', background: '#ffb3b3' }}
          onClick={() => {
            if (window.confirm('Clear this entire conversation? This cannot be undone.')) {
              onClearChat?.();
            }
          }}
        >
          Clear chat
        </button>
      </aside>
    </>
  );
};

export { BACKGROUNDS };
export default RightPanel;
