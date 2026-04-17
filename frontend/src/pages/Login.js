import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AvatarPicker from '../components/AvatarPicker';
import TypewriterText from '../components/TypewriterText';
import AVATARS, { getAvatarUrl } from '../data/avatars';

const randomCuteName = () => {
  const adjectives = ['Fluffy', 'Sunny', 'Cozy', 'Peachy', 'Sparkly', 'Cheery', 'Dreamy', 'Mochi', 'Cloudy', 'Honey', 'Bubbly', 'Cuddly'];
  const nouns = ['Bun', 'Kitten', 'Star', 'Petal', 'Puff', 'Cloud', 'Cookie', 'Panda', 'Bear', 'Berry', 'Muffin', 'Sprout'];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${num}`;
};

const Login = () => {
  const [tab, setTab] = useState('register');
  const [name, setName] = useState(randomCuteName());
  const [avatar, setAvatar] = useState(AVATARS[Math.floor(Math.random() * AVATARS.length)].seed);
  const [loginCode, setLoginCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newCode, setNewCode] = useState(null);
  const { register, loginWithCode, checkName } = useAuth();
  const navigate = useNavigate();

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
    const avatarUrl = getAvatarUrl(avatar);
    const r = await register(name.trim(), avatarUrl);
    setBusy(false);
    if (!r.success) return setError(r.error);
    setNewCode(r.user.loginCode);
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
    navigate('/home');
  };

  if (newCode) {
    return (
      <div className="center">
        <div className="login-card pop-in" style={{ textAlign: 'center' }}>
          <div className="float" style={{ fontSize: 60, marginBottom: 10 }}>🎉</div>
          <h2 style={{ margin: '0 0 8px' }}>Welcome, {name}!</h2>
          <p style={{ color: '#777', fontSize: 14 }}>
            Save this code — you'll need it to log back in next time.<br />
            <strong style={{ color: '#e57373' }}>Don't lose it, or your chat history will be gone!</strong>
          </p>
          <div style={{ margin: '20px 0' }}>
            <div className="code-display sparkle">{newCode}</div>
          </div>
          <button
            className="btn"
            onClick={() => { navigator.clipboard?.writeText(newCode).catch(() => {}); }}
            style={{ marginRight: 8 }}
          >
            📋 Copy code
          </button>
          <button className="btn btn-blue" onClick={() => navigate('/home')}>
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
          <button className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); setError(''); }}>
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

            <label>
              <span style={{ fontSize: 13, color: '#888' }}>Pick a sticker face</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0' }}>
                <img className="avatar-lg sticker-bounce" src={getAvatarUrl(avatar)} alt="" style={{ width: 64, height: 64 }} />
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Tap any sticker below to choose ✿</p>
              </div>
              <AvatarPicker selected={avatar} onSelect={setAvatar} />
            </label>

            {error && <p style={{ color: '#e57373', fontSize: 13, margin: 0 }}>{error}</p>}

            <button className="btn" disabled={busy} type="submit">
              {busy ? 'Creating...' : '✿ Create my account'}
            </button>
          </form>
        ) : (
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

            {error && <p style={{ color: '#e57373', fontSize: 13, margin: 0 }}>{error}</p>}

            <button className="btn btn-blue" disabled={busy} type="submit">
              {busy ? 'Checking...' : '🔑 Log back in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
