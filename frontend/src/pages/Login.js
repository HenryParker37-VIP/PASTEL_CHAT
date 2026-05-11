import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AvatarCustomizer from '../components/AvatarCustomizer';
import TypewriterText from '../components/TypewriterText';
import { getAvatarUrl } from '../data/avatars';

const randomCuteName = () => {
  const adjectives = ['Fluffy', 'Sunny', 'Cozy', 'Peachy', 'Sparkly', 'Cheery', 'Dreamy', 'Mochi', 'Cloudy', 'Honey', 'Bubbly', 'Cuddly'];
  const nouns = ['Bun', 'Kitten', 'Star', 'Petal', 'Puff', 'Cloud', 'Cookie', 'Panda', 'Bear', 'Berry', 'Muffin', 'Sprout'];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${num}`;
};

// Read last-used account from localStorage (code is stored in user object)
function getStoredAccount() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u?.loginCode) return u;
    return null;
  } catch { return null; }
}

const Login = () => {
  const [tab, setTab] = useState('register');
  const [name, setName] = useState(randomCuteName());
  const [avatarUrl, setAvatarUrl] = useState(() => getAvatarUrl('Peach'));
  const [loginCode, setLoginCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newCode, setNewCode] = useState(null);
  const [newName, setNewName] = useState('');
  const [codeSaved, setCodeSaved] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const { register, loginWithCode, checkName } = useAuth();
  const navigate = useNavigate();

  const storedAccount = getStoredAccount();

  const handleCheckName = async () => {
    setError('');
    if (!name.trim()) return false;
    const r = await checkName(name);
    if (!r.available) setError(r.reason || 'Name already used');
    return r.available;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Please pick a name');
    setBusy(true);
    const r = await register(name.trim(), avatarUrl);
    setBusy(false);
    if (!r.success) return setError(r.error);
    setNewCode(r.user.loginCode);
    setNewName(r.user.name || name.trim());
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const code = loginCode.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
    if (code.replace('-', '').length < 8) return setError('Enter your 8-character login code');
    setBusy(true);
    const r = await loginWithCode(code);
    setBusy(false);
    if (!r.success) return setError(r.error);
    if (r.user.loginCode === 'ADMN-0307' || r.user.isAdmin) {
      navigate('/admin');
    } else {
      navigate('/home');
    }
  };

  const handleRecoverLogin = async () => {
    if (!storedAccount?.loginCode) return;
    setBusy(true);
    setError('');
    const r = await loginWithCode(storedAccount.loginCode);
    setBusy(false);
    if (!r.success) {
      setError('Recovery failed — your account may no longer exist on this server.');
      return;
    }
    navigate('/home');
  };

  // Step 2: Show the code, require confirmation before entering
  if (newCode && !codeSaved) {
    return (
      <div className="center">
        <div className="login-card pop-in" style={{ textAlign: 'center' }}>
          <div className="float" style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
          <h2 style={{ margin: '0 0 6px' }}>Welcome, {newName}!</h2>

          <div style={{
            background: '#FFF3CD',
            border: '2px solid #FFCA28',
            borderRadius: 14,
            padding: '12px 16px',
            margin: '16px 0',
            textAlign: 'left'
          }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#856404', fontSize: 14 }}>
              ⚠️ Save this code — it's the only way to log back in!
            </p>
            <p style={{ margin: '4px 0 0', color: '#856404', fontSize: 13 }}>
              There's no email recovery. If you lose this code, your account is gone forever.
            </p>
          </div>

          <div style={{ margin: '16px 0' }}>
            <div className="code-display sparkle" style={{ fontSize: 28, letterSpacing: '0.3em' }}>
              {newCode}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <button
              className="btn btn-lavender"
              onClick={() => { navigator.clipboard?.writeText(newCode).catch(() => {}); }}
            >
              📋 Copy code
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                const msg = `My Pastel Chat login code: ${newCode}\nDon't share this with anyone!`;
                if (navigator.share) {
                  navigator.share({ text: msg }).catch(() => {});
                } else {
                  navigator.clipboard?.writeText(msg).catch(() => {});
                }
              }}
            >
              📤 Share / Save
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', justifyContent: 'center', marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={codeSaved}
              onChange={e => setCodeSaved(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#4A4A4A' }}>
              Yes, I saved my login code safely ✓
            </span>
          </label>

          <button
            className="btn btn-blue"
            disabled={!codeSaved}
            onClick={() => navigate('/home')}
            style={{ width: '100%' }}
          >
            Enter PastelChat →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="center">
      <div className="login-card pop-in">
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 50 }} className="sticker-bounce">🌸</div>
          <h1 style={{ margin: '6px 0 4px', fontSize: 30 }}>
            <span style={{
              background: 'linear-gradient(90deg, #FFB6C1, #DDA0DD, #ADD8E6)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent'
            }}>PastelChat</span>
          </h1>
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>
            <TypewriterText
              words={['A cozy place to chat', 'Sweet as a daydream', 'Hi there, friend']}
              typingSpeed={70}
            />
          </p>
        </div>

        <div className="login-tabs">
          <button className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); setError(''); setShowRecovery(false); }}>
            New here
          </button>
          <button className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); setError(''); }}>
            Have a code
          </button>
        </div>

        {tab === 'register' ? (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label>
              <span style={{ fontSize: 13, color: '#888' }}>Pick a name</span>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  onBlur={handleCheckName}
                  placeholder="CuddlyBun42"
                  maxLength={20}
                />
                <button
                  type="button"
                  className="btn btn-lavender"
                  onClick={() => setName(randomCuteName())}
                  title="Generate cute name"
                >🎲</button>
              </div>
            </label>

            <div>
              <span style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 8 }}>Pick your avatar ✿</span>
              <AvatarCustomizer
                currentAvatarUrl={avatarUrl}
                onAvatarChange={setAvatarUrl}
                compact
              />
            </div>

            {error && <p style={{ color: '#e57373', fontSize: 13, margin: 0 }}>{error}</p>}

            <button className="btn" disabled={busy} type="submit">
              {busy ? 'Creating...' : '✿ Create my account'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Device recovery banner */}
            {storedAccount && !showRecovery && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #FFF0F5, #EDE7FF)',
                  border: '1.5px solid #DDA0DD',
                  borderRadius: 14,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer'
                }}
                onClick={() => setShowRecovery(true)}
              >
                {storedAccount.avatar && (
                  <img src={storedAccount.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#6B4E8B' }}>
                    Previously logged in as {storedAccount.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#9B7EB8' }}>
                    Tap to recover your code from this device
                  </div>
                </div>
                <span style={{ color: '#DDA0DD', fontSize: 18 }}>›</span>
              </div>
            )}

            {/* Recovery panel */}
            {storedAccount && showRecovery && (
              <div style={{
                background: 'linear-gradient(135deg, #FFF0F5, #EDE7FF)',
                border: '1.5px solid #DDA0DD',
                borderRadius: 14,
                padding: '14px'
              }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6B4E8B', fontWeight: 600 }}>
                  Your saved login code for <strong>{storedAccount.name}</strong>:
                </p>
                <div style={{
                  background: 'white',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontFamily: 'monospace',
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  color: '#4A4A4A',
                  textAlign: 'center',
                  marginBottom: 10
                }}>
                  {storedAccount.loginCode}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-lavender"
                    style={{ flex: 1, fontSize: 13 }}
                    onClick={() => navigator.clipboard?.writeText(storedAccount.loginCode).catch(() => {})}
                  >📋 Copy</button>
                  <button
                    className="btn"
                    style={{ flex: 1, fontSize: 13 }}
                    disabled={busy}
                    onClick={handleRecoverLogin}
                  >{busy ? 'Logging in...' : '🔑 Log in now'}</button>
                </div>
                <button
                  onClick={() => setShowRecovery(false)}
                  style={{ marginTop: 8, fontSize: 12, color: '#999', width: '100%', textAlign: 'center' }}
                >
                  Cancel
                </button>
                {error && <p style={{ color: '#e57373', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label>
                <span style={{ fontSize: 13, color: '#888' }}>Your login code</span>
                <input
                  className="code-input"
                  value={loginCode}
                  onChange={(e) => { setLoginCode(e.target.value); setError(''); }}
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                />
              </label>

              {error && !showRecovery && <p style={{ color: '#e57373', fontSize: 13, margin: 0 }}>{error}</p>}

              <button className="btn btn-blue" disabled={busy} type="submit">
                {busy ? 'Checking...' : '🔑 Log back in'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
