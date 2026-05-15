import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../i18n';
import { signInWithMicrosoft } from '../services/microsoft-auth';
import TypewriterText from '../components/TypewriterText';
import AVATARS, {
  getAvatarUrl,
  getCharacterAvatarUrl,
  SKIN_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  PASTEL_BG_COLORS,
  EXPRESSIONS,
  ACCESSORIES,
  OUTFITS,
} from '../data/avatars';

const randomCuteName = () => {
  const adjectives = ['Fluffy', 'Sunny', 'Cozy', 'Peachy', 'Sparkly', 'Cheery', 'Dreamy', 'Mochi', 'Cloudy', 'Honey', 'Bubbly', 'Cuddly'];
  const nouns = ['Bun', 'Kitten', 'Star', 'Petal', 'Puff', 'Cloud', 'Cookie', 'Panda', 'Bear', 'Berry', 'Muffin', 'Sprout'];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${num}`;
};

function getStoredAccount() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u?.loginCode) return u;
    return null;
  } catch { return null; }
}

// ── Sticker Avatar Modal ──────────────────────────────────────────────────────
const StickerAvatarModal = ({ currentUrl, onConfirm, onClose }) => {
  const initSeed = (() => {
    try { return currentUrl?.match(/[?&]seed=([^&]+)/)?.[1] || 'Peach'; } catch { return 'Peach'; }
  })();
  const initBg = (() => {
    try { return currentUrl?.match(/backgroundColor=([^&,]+)/)?.[1] || 'ffb6c1'; } catch { return 'ffb6c1'; }
  })();
  const [seed, setSeed] = useState(decodeURIComponent(initSeed));
  const [bg, setBg] = useState(initBg);
  const preview = getAvatarUrl(seed, bg);

  return (
    <div className="avatar-modal-overlay" onClick={onClose}>
      <div className="avatar-modal" onClick={e => e.stopPropagation()}>
        <div className="avatar-modal-header">
          <span className="avatar-modal-title">🩷 Pick a Sticker Avatar</span>
          <button type="button" className="avatar-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <img src={preview} alt="preview" style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid #F0E4F8' }} />
        </div>

        {/* Background colors */}
        <div style={{ marginBottom: 14 }}>
          <div className="avatar-section-label">Background Color</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {PASTEL_BG_COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                onClick={() => setBg(c.hex)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: `#${c.hex}`,
                  border: bg === c.hex ? '3px solid #DDA0DD' : '2px solid transparent',
                  outline: bg === c.hex ? '2px solid #DDA0DD' : 'none',
                  outlineOffset: 1,
                  cursor: 'pointer', padding: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Sticker grid */}
        <div className="avatar-section-label" style={{ marginBottom: 8 }}>Choose Your Face</div>
        <div className="sticker-avatar-grid">
          {AVATARS.map(av => (
            <button
              key={av.id}
              type="button"
              onClick={() => setSeed(av.seed)}
              title={av.seed}
              className={`sticker-avatar-item ${seed === av.seed ? 'selected' : ''}`}
            >
              <img src={getAvatarUrl(av.seed, bg)} alt={av.seed} />
              <span>{av.seed}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn"
          style={{ width: '100%', marginTop: 16 }}
          onClick={() => { onConfirm(preview); onClose(); }}
        >
          ✓ Use This Avatar
        </button>
      </div>
    </div>
  );
};

// ── Character Avatar Modal ────────────────────────────────────────────────────
const SwatchRow = ({ label, items, selected, onSelect, size = 28 }) => (
  <div style={{ marginBottom: 14 }}>
    <div className="avatar-section-label">{label}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          onClick={() => onSelect(item)}
          style={{
            width: size, height: size, borderRadius: '50%',
            background: `#${item.hex}`,
            border: selected === item.hex ? '3px solid #DDA0DD' : '2px solid transparent',
            outline: selected === item.hex ? '2px solid #DDA0DD' : 'none',
            outlineOffset: 1, cursor: 'pointer', padding: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            transition: 'transform 0.12s',
          }}
        />
      ))}
    </div>
  </div>
);

const OptionRow = ({ label, items, selected, onSelect }) => (
  <div style={{ marginBottom: 14 }}>
    <div className="avatar-section-label">{label}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          style={{
            padding: '4px 10px', borderRadius: 20, border: '1.5px solid',
            borderColor: selected === item.value ? '#DDA0DD' : '#E8D5F0',
            background: selected === item.value ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : 'white',
            color: selected === item.value ? 'white' : '#888',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  </div>
);

const CharacterAvatarModal = ({ currentUrl, onConfirm, onClose }) => {
  const [opts, setOpts] = useState({
    skinColor: 'f8d9c4',
    hairColor: '4a2c2c',
    hairStyle: 'variant01',
    bgColor: 'ffb6c1',
    eyes: 'variant01',
    glasses: '',
    outfit: 'variant01',
    earrings: false,
  });

  const patch = (p) => setOpts(prev => ({ ...prev, ...p }));
  const previewUrl = getCharacterAvatarUrl(opts);

  return (
    <div className="avatar-modal-overlay" onClick={onClose}>
      <div className="avatar-modal" onClick={e => e.stopPropagation()}>
        <div className="avatar-modal-header">
          <span className="avatar-modal-title">🎨 Design Your Character</span>
          <button type="button" className="avatar-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <img src={previewUrl} alt="preview" style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid #F0E4F8' }} />
        </div>

        <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
          <SwatchRow label="Skin Tone" items={SKIN_COLORS} selected={opts.skinColor} onSelect={i => patch({ skinColor: i.hex })} />
          <SwatchRow label="Hair Color" items={HAIR_COLORS} selected={opts.hairColor} onSelect={i => patch({ hairColor: i.hex })} size={24} />
          <OptionRow label="Hair Style" items={HAIR_STYLES} selected={opts.hairStyle} onSelect={i => patch({ hairStyle: i.value })} />
          <SwatchRow label="Background" items={PASTEL_BG_COLORS} selected={opts.bgColor} onSelect={i => patch({ bgColor: i.hex })} />
          <OptionRow label="Expression" items={EXPRESSIONS} selected={opts.eyes} onSelect={i => patch({ eyes: i.value })} />
          <OptionRow label="Glasses" items={ACCESSORIES} selected={opts.glasses} onSelect={i => patch({ glasses: i.value })} />
          <OptionRow label="Outfit" items={OUTFITS} selected={opts.outfit} onSelect={i => patch({ outfit: i.value })} />
          {/* Earrings */}
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar-section-label" style={{ margin: 0 }}>Earrings</div>
            <button
              type="button"
              onClick={() => patch({ earrings: !opts.earrings })}
              style={{
                padding: '4px 12px', borderRadius: 20, border: '1.5px solid',
                borderColor: opts.earrings ? '#DDA0DD' : '#E8D5F0',
                background: opts.earrings ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : 'white',
                color: opts.earrings ? 'white' : '#888',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opts.earrings ? '✓ On' : 'Off'}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn"
          style={{ width: '100%', marginTop: 16 }}
          onClick={() => { onConfirm(previewUrl); onClose(); }}
        >
          ✓ Use This Character
        </button>
      </div>
    </div>
  );
};

// ── Main Login Component ──────────────────────────────────────────────────────
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
  const [avatarModal, setAvatarModal] = useState(null); // 'sticker' | 'character' | null
  const { register, loginWithCode, loginWithGoogle, loginWithMicrosoft, checkName } = useAuth();
  const { t, lang, setLang } = useLang();
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
    if (!name.trim()) return setError(t('loginPickNameFirst'));
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
    if (code.replace('-', '').length < 8) return setError(t('loginEnterCode'));
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

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setBusy(true);
    const r = await loginWithGoogle(credentialResponse);
    setBusy(false);
    if (!r.success) return setError(r.error);
    window.location.replace('/home');
  };

  const handleGoogleError = () => {
    setError(t('loginGoogleFailed'));
  };

  const handleMicrosoftLogin = async () => {
    if (!process.env.REACT_APP_MICROSOFT_CLIENT_ID) {
      return setError('Microsoft login is not configured yet. Please add REACT_APP_MICROSOFT_CLIENT_ID to your .env file.');
    }
    setError('');
    setBusy(true);
    try {
      const accessToken = await signInWithMicrosoft();
      const r = await loginWithMicrosoft(accessToken);
      if (!r.success) return setError(r.error);
      window.location.replace('/home');
    } catch (err) {
      if (err.errorCode !== 'user_cancelled') {
        setError('Microsoft sign-in failed. Please try again.');
        console.error('[Microsoft]', err);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRecoverLogin = async () => {
    if (!storedAccount?.loginCode) return;
    setBusy(true);
    setError('');
    const r = await loginWithCode(storedAccount.loginCode);
    setBusy(false);
    if (!r.success) {
      setError(t('loginRecoverFailed'));
      return;
    }
    navigate('/home');
  };

  // Step 2: Show the login code
  if (newCode && !codeSaved) {
    return (
      <div className="center">
        <div className="login-card pop-in" style={{ textAlign: 'center' }}>
          <div className="float" style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
          <h2 style={{ margin: '0 0 6px' }}>{t('loginWelcome', newName)}</h2>

          <div style={{
            background: '#FFF3CD', border: '2px solid #FFCA28',
            borderRadius: 14, padding: '12px 16px', margin: '16px 0', textAlign: 'left'
          }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#856404', fontSize: 14 }}>
              {t('loginSaveWarningTitle')}
            </p>
            <p style={{ margin: '4px 0 0', color: '#856404', fontSize: 13 }}>
              {t('loginSaveWarningBody')}
            </p>
          </div>

          <div style={{ margin: '16px 0' }}>
            <div className="code-display sparkle" style={{ fontSize: 28, letterSpacing: '0.3em' }}>
              {newCode}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <button className="btn btn-lavender" onClick={() => { navigator.clipboard?.writeText(newCode).catch(() => {}); }}>
              {t('loginCopyCode')}
            </button>
            <button className="btn btn-ghost" onClick={() => {
              const msg = `My Pastel Chat login code: ${newCode}\nDon't share this with anyone!`;
              if (navigator.share) { navigator.share({ text: msg }).catch(() => {}); }
              else { navigator.clipboard?.writeText(msg).catch(() => {}); }
            }}>
              {t('loginShareSave')}
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', justifyContent: 'center', marginBottom: 16 }}>
            <input type="checkbox" checked={codeSaved} onChange={e => setCodeSaved(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#4A4A4A' }}>{t('loginConfirmSaved')}</span>
          </label>

          <button className="btn btn-blue" disabled={!codeSaved} onClick={() => navigate('/home')} style={{ width: '100%' }}>
            {t('loginEnterApp')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Avatar modals */}
      {avatarModal === 'sticker' && (
        <StickerAvatarModal
          currentUrl={avatarUrl}
          onConfirm={(url) => setAvatarUrl(url)}
          onClose={() => setAvatarModal(null)}
        />
      )}
      {avatarModal === 'character' && (
        <CharacterAvatarModal
          currentUrl={avatarUrl}
          onConfirm={(url) => setAvatarUrl(url)}
          onClose={() => setAvatarModal(null)}
        />
      )}

      <div className="center">
        <div className="login-card pop-in">
          {/* Language toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <button
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              style={{
                background: 'linear-gradient(135deg, #F0E8FF, #E8F4FD)',
                border: '1.5px solid #DDD0F0',
                borderRadius: 20, padding: '4px 12px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                color: '#7B5EA7', display: 'flex', alignItems: 'center', gap: 5
              }}
            >
              {lang === 'vi' ? '🇬🇧 English' : '🇻🇳 Tiếng Việt'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 50 }} className="sticker-bounce">🌸</div>
            <h1 style={{ margin: '6px 0 4px', fontSize: 30 }}>
              <span style={{
                background: 'linear-gradient(90deg, #FFB6C1, #DDA0DD, #ADD8E6)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'
              }}>PastelChat</span>
            </h1>
            <p style={{ margin: 0, color: '#888', fontSize: 14 }}>
              <TypewriterText
                words={lang === 'vi'
                  ? ['Không gian trò chuyện ấm cúng', 'Ngọt ngào như giấc mơ', 'Chào bạn, người bạn nhỏ']
                  : ['A cozy place to chat', 'Sweet as a daydream', 'Hi there, friend']}
                typingSpeed={70}
              />
            </p>
          </div>

          {/* Tier comparison strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #E8F4FD, #EDE7FF)',
              border: '1.5px solid #C2D8F5', borderRadius: 12, padding: '10px 10px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 18, marginBottom: 3 }}>🔐</div>
              <div style={{ fontWeight: 800, fontSize: 12, color: '#4285F4', marginBottom: 4 }}>{t('loginGooglePremium')}</div>
              <div style={{ fontSize: 10, color: '#666', lineHeight: 1.5 }}>
                ✅ {t('loginPersistentProfile')}<br />
                ✅ {t('loginPhotoEncryption')}<br />
                ✅ {t('loginNoCodeToSave')}<br />
                ✅ {t('loginGoogleAvatar')}
              </div>
            </div>
            <div style={{
              background: '#FAFAFA', border: '1.5px solid #E8E8E8',
              borderRadius: 12, padding: '10px 10px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 18, marginBottom: 3 }}>👤</div>
              <div style={{ fontWeight: 800, fontSize: 12, color: '#888', marginBottom: 4 }}>{t('loginStandard')}</div>
              <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.5 }}>
                ✓ {t('loginAnonChat')}<br />
                ✓ {t('loginCustomAvatar')}<br />
                ✓ {t('loginAllFeatures')}<br />
                ⚠️ {t('loginMustSaveCode')}
              </div>
            </div>
          </div>

          <div className="login-tabs">
            <button className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); setError(''); setShowRecovery(false); }}>
              {t('loginNewHere')}
            </button>
            <button className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); setError(''); }}>
              {t('loginHaveCode')}
            </button>
          </div>

          {tab === 'register' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── Google Premium (recommended) ── */}
              <div style={{
                background: 'linear-gradient(135deg, #E8F4FD 0%, #EDE7FF 100%)',
                border: '2px solid #C2D8F5', borderRadius: 16, padding: '14px 16px',
                position: 'relative', overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute', top: 8, right: 10,
                  background: 'linear-gradient(135deg, #4285F4, #34A853)',
                  color: 'white', fontSize: 9, fontWeight: 800,
                  padding: '2px 8px', borderRadius: 10
                }}>{t('loginGoogleRecommended')}</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#3A5DB0', marginBottom: 2 }}>
                  {t('loginGoogleTitle')}
                </div>
                <div style={{ fontSize: 11, color: '#7090C0', marginBottom: 12, lineHeight: 1.4 }}>
                  {t('loginGoogleDesc')}
                </div>
                <div className="google-btn-wrap" style={{ display: 'flex', justifyContent: 'center' }}>
                  <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} shape="pill" theme="outline" text="signup_with" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={handleMicrosoftLogin}
                    disabled={busy}
                    className="microsoft-btn"
                  >
                    <svg width="18" height="18" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
                      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                    </svg>
                    Sign up with Microsoft
                  </button>
                </div>
                {error && <p style={{ color: '#e57373', fontSize: 12, margin: '8px 0 0', textAlign: 'center' }}>{error}</p>}
              </div>

              {/* Divider */}
              <div className="google-divider"><span>{t('loginOrCreate')}</span></div>

              {/* ── Standard / Code signup ── */}
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  background: '#FFF8F0', border: '1px solid #FFE0B0',
                  borderRadius: 10, padding: '8px 12px', fontSize: 11, color: '#B08000'
                }}>
                  {t('loginCodeWarning')}
                </div>

                <label>
                  <span style={{ fontSize: 13, color: '#888' }}>{t('loginPickName')}</span>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <input
                      className="input"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError(''); }}
                      onBlur={handleCheckName}
                      placeholder="CuddlyBun42"
                      maxLength={20}
                    />
                    <button type="button" className="btn btn-lavender" onClick={() => setName(randomCuteName())} title="Generate cute name">🎲</button>
                  </div>
                </label>

                {/* Avatar picker */}
                <div>
                  <span style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 10 }}>{t('loginPickAvatar')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <img
                      src={avatarUrl}
                      alt="Your avatar"
                      style={{ width: 64, height: 64, borderRadius: '50%', border: '3px solid #F0E4F8', objectFit: 'cover', flexShrink: 0 }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button type="button" className="avatar-type-btn" onClick={() => setAvatarModal('sticker')}>
                        🩷 Sticker Avatar
                      </button>
                      <button type="button" className="avatar-type-btn" onClick={() => setAvatarModal('character')}>
                        🎨 Character Avatar
                      </button>
                    </div>
                  </div>
                </div>

                {error && <p style={{ color: '#e57373', fontSize: 13, margin: 0 }}>{error}</p>}

                <button className="btn" disabled={busy} type="submit">
                  {busy ? t('loginCreating') : t('loginCreateStandard')}
                </button>
              </form>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── Google sign-in (top of login tab too) ── */}
              <div style={{
                background: 'linear-gradient(135deg, #E8F4FD 0%, #EDE7FF 100%)',
                border: '2px solid #C2D8F5', borderRadius: 16, padding: '14px 16px',
              }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#3A5DB0', marginBottom: 2 }}>
                  {t('loginGoogleTitle')}
                </div>
                <div style={{ fontSize: 11, color: '#7090C0', marginBottom: 12 }}>
                  {t('loginGoogleDesc')}
                </div>
                <div className="google-btn-wrap" style={{ display: 'flex', justifyContent: 'center' }}>
                  <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} shape="pill" theme="outline" text="signin_with" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={handleMicrosoftLogin}
                    disabled={busy}
                    className="microsoft-btn"
                  >
                    <svg width="18" height="18" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
                      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                    </svg>
                    Sign in with Microsoft
                  </button>
                </div>
                {error && <p style={{ color: '#e57373', fontSize: 12, margin: '8px 0 0', textAlign: 'center' }}>{error}</p>}
              </div>

              <div className="google-divider"><span>{t('loginOrLogin')}</span></div>

              {/* Device recovery banner */}
              {storedAccount && !showRecovery && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #FFF0F5, #EDE7FF)',
                    border: '1.5px solid #DDA0DD', borderRadius: 14,
                    padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer'
                  }}
                  onClick={() => setShowRecovery(true)}
                >
                  {storedAccount.avatar && (
                    <img src={storedAccount.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#6B4E8B' }}>
                      {t('loginPrevDevice', storedAccount.name)}
                    </div>
                    <div style={{ fontSize: 12, color: '#9B7EB8' }}>{t('loginRecoverHint')}</div>
                  </div>
                  <span style={{ color: '#DDA0DD', fontSize: 18 }}>›</span>
                </div>
              )}

              {storedAccount && showRecovery && (
                <div style={{
                  background: 'linear-gradient(135deg, #FFF0F5, #EDE7FF)',
                  border: '1.5px solid #DDA0DD', borderRadius: 14, padding: '14px'
                }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6B4E8B', fontWeight: 600 }}>
                    Your saved login code for <strong>{storedAccount.name}</strong>:
                  </p>
                  <div style={{
                    background: 'white', borderRadius: 10, padding: '10px 14px',
                    fontFamily: 'monospace', fontSize: 20, fontWeight: 700,
                    letterSpacing: '0.2em', color: '#4A4A4A', textAlign: 'center', marginBottom: 10
                  }}>
                    {storedAccount.loginCode}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-lavender" style={{ flex: 1, fontSize: 13 }}
                      onClick={() => navigator.clipboard?.writeText(storedAccount.loginCode).catch(() => {})}>📋 {t('loginCopyCode').replace('📋 ', '')}</button>
                    <button className="btn" style={{ flex: 1, fontSize: 13 }} disabled={busy} onClick={handleRecoverLogin}>
                      {busy ? t('loginChecking') : t('loginLogBackIn')}
                    </button>
                  </div>
                  <button onClick={() => setShowRecovery(false)}
                    style={{ marginTop: 8, fontSize: 12, color: '#999', width: '100%', textAlign: 'center' }}>
                    {t('cancel')}
                  </button>
                  {error && <p style={{ color: '#e57373', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label>
                  <span style={{ fontSize: 13, color: '#888' }}>{t('loginCodeLabel')}</span>
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
                  {busy ? t('loginChecking') : t('loginLogBackIn')}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Login;

