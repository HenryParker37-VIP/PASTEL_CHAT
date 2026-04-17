import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Privacy = () => {
  const navigate = useNavigate();
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notifyPref, setNotifyPref] = useState(() => {
    return localStorage.getItem('pastelchat.notify') === '1';
  });

  useEffect(() => {
    if (!notifyPref) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [notifyPref]);

  const toggleNotify = (val) => {
    setNotifyPref(val);
    localStorage.setItem('pastelchat.notify', val ? '1' : '0');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!message.trim()) return setError('Please describe what happened');
    setBusy(true);
    try {
      await api.post('/feedback', { type, message: message.trim() });
      setSent(true);
      setMessage('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send. Try again soon.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>← Back</button>
      <h2 style={{ margin: '4px 0 14px' }}>🔒 Privacy & support</h2>

      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>🔔 Notifications</h3>
        <p style={{ fontSize: 14, color: '#666' }}>
          PastelChat can ping your browser when new messages or friend requests arrive.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={notifyPref}
            onChange={(e) => toggleNotify(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span>Enable browser notifications</span>
        </label>
      </div>

      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>🛡️ What we store</h3>
        <ul style={{ fontSize: 14, color: '#666', paddingLeft: 20 }}>
          <li>Your name, sticker face, and login code (needed to find you again)</li>
          <li>Your friend list with the nicknames you've set</li>
          <li>Your messages (so you can scroll back) — cleared any time from the right panel</li>
        </ul>
        <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Nothing is shared outside PastelChat. No ads, no tracking ✿</p>
      </div>

      <div className="card pop-in">
        <h3 style={{ marginTop: 0 }}>🐞 Found a bug or have an idea?</h3>
        <p style={{ fontSize: 14, color: '#666' }}>
          Your note goes straight to the creator — Nguyen Manh Tuan Hung (Henry Parker).
        </p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div className="pop-in" style={{ fontSize: 50 }}>💌</div>
            <p style={{ fontWeight: 700 }}>Sent! Thank you for helping make PastelChat better.</p>
            <button className="btn btn-ghost" onClick={() => setSent(false)}>Send another</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['bug', 'feature', 'feedback'].map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(t)}
                  className={`btn ${type === t ? '' : 'btn-ghost'}`}
                  style={{ flex: 1, textTransform: 'capitalize' }}
                >
                  {t === 'bug' ? '🐞 Bug' : t === 'feature' ? '✨ Feature' : '💭 Feedback'}
                </button>
              ))}
            </div>
            <textarea
              className="input"
              style={{ borderRadius: 16, minHeight: 120, padding: 14, resize: 'vertical' }}
              placeholder="Tell the creator what's on your mind..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
            />
            {error && <p style={{ color: '#e57373', fontSize: 13, margin: 0 }}>{error}</p>}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Sending...' : '💌 Send to creator'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Privacy;
