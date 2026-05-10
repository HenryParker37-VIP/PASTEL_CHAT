import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLang } from '../i18n';
import TypewriterText from '../components/TypewriterText';

const TILES = [
  {
    emoji: '🎨',
    key: 'profile',
    labelKey: 'homeChangeName',
    descKey: 'homeChangeNameDesc',
    path: '/profile',
    grad: 'linear-gradient(135deg, #FFB6C1 0%, #FF8FA3 100%)',
  },
  {
    emoji: '💬',
    key: 'chat',
    labelKey: 'homeChatFriends',
    descKey: 'homeChatFriendsDesc',
    path: '/friends',
    grad: 'linear-gradient(135deg, #ADD8E6 0%, #7EC8E3 100%)',
  },
  {
    emoji: '👥',
    key: 'groups',
    labelKey: 'homeGroups',
    descKey: 'homeGroupsDesc',
    path: '/friends',
    grad: 'linear-gradient(135deg, #B0E0E6 0%, #7DC9C9 100%)',
  },
  {
    emoji: '📸',
    key: 'photos',
    labelKey: 'homeSharedPhotos',
    descKey: 'homeSharedPhotosDesc',
    path: '/my-space?tab=photos',
    grad: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
  },
  {
    emoji: '✨',
    key: 'myspace',
    labelKey: 'homeMySpace',
    descKey: 'homeMySpaceDesc',
    path: '/my-space',
    grad: 'linear-gradient(135deg, #DDA0DD 0%, #C07BC0 100%)',
  },
  {
    emoji: '🔒',
    key: 'privacy',
    labelKey: 'homePrivacy',
    descKey: 'homePrivacyDesc',
    path: '/privacy',
    grad: 'linear-gradient(135deg, #FFE4E1 0%, #FFB6C1 100%)',
  },
];

const Home = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const { t } = useLang();
  const [time, setTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 700);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 700);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isMobile) {
    return (
      <div className="home-mobile-wrap">
        {/* Mobile header */}
        <div className="home-mobile-header">
          <div className="home-mobile-user">
            <img className="home-mobile-avatar sticker-wiggle" src={user?.avatar} alt="" />
            <div>
              <p className="home-mobile-name">{user?.name}</p>
              <p className="home-mobile-status">
                <span className="home-mobile-dot" style={{ background: connected ? '#7bd389' : '#ccc' }} />
                {connected ? t('connected') : t('connecting')}
              </p>
            </div>
          </div>
          <button className="home-mobile-logout" onClick={logout}>{t('logout')}</button>
        </div>

        {/* Greeting */}
        <div className="home-mobile-greeting">
          <TypewriterText
            words={[t('homeWelcome', user?.name?.split(' ')[0] || 'friend'), t('homeWelcomeAlt'), 'Shall we chat? 🌸']}
            typingSpeed={80}
          />
        </div>

        {/* 2×3 App icon grid */}
        <div className="home-mobile-grid">
          {TILES.map((tile, i) => (
            <button
              key={tile.key}
              className="home-mobile-tile pop-in"
              style={{ animationDelay: `${i * 0.06}s`, background: tile.grad }}
              onClick={() => navigate(tile.path)}
            >
              <span className="home-mobile-emoji float" style={{ animationDelay: `${i * 0.15}s` }}>
                {tile.emoji}
              </span>
              <span className="home-mobile-label">{t(tile.labelKey)}</span>
            </button>
          ))}
        </div>

        {/* Login code */}
        {user?.loginCode && (
          <div className="home-mobile-code-wrap">
            <p className="home-mobile-code-hint">{t('homeLoginCode')}</p>
            <div className="code-display">{user.loginCode}</div>
            <div
              onClick={() => navigate('/install')}
              style={{
                marginTop: 12,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 20,
                background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 100%)',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: 15 }}>📲</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Add to home screen</span>
            </div>
          </div>
        )}

        {/* Time */}
        <p className="home-mobile-time">{time.toLocaleTimeString()}</p>
      </div>
    );
  }

  // ── Desktop layout (unchanged) ────────────────────────────────────────────
  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img className="avatar sticker-wiggle" src={user?.avatar} alt="" />
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{user?.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: connected ? '#7bd389' : '#ccc', marginRight: 6
              }} />
              {connected ? t('connected') : t('connecting')} · {time.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={logout}>{t('logout')}</button>
      </div>

      <div className="hero">
        <h1>
          <TypewriterText
            words={[t('homeWelcome', user?.name || 'friend'), t('homeWelcomeAlt'), 'Shall we chat?']}
            typingSpeed={80}
          />
        </h1>
        <p className="tagline">{t('homeTagline')}</p>
      </div>

      <div className="home-grid">
        {TILES.map((tile, i) => (
          <div
            key={tile.key}
            className="home-tile pop-in"
            style={{ animationDelay: `${0.05 + i * 0.05}s` }}
            onClick={() => navigate(tile.path)}
          >
            <span className="emoji float" style={{ animationDelay: `${i * 0.15}s` }}>{tile.emoji}</span>
            <h3>{t(tile.labelKey)}</h3>
            <p>{t(tile.descKey)}</p>
          </div>
        ))}
      </div>

      {user?.loginCode && (
        <div className="card pop-in" style={{ marginTop: 30, textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: '#888' }}>{t('homeLoginCode')}</p>
          <div className="code-display">{user.loginCode}</div>
          <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>{t('homeLoginCodeHint')}</p>
          <div
            onClick={() => navigate('/install')}
            style={{
              marginTop: 14,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 20,
              background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 100%)',
              cursor: 'pointer', border: 'none'
            }}
          >
            <span style={{ fontSize: 15 }}>📲</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Add to home screen</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
