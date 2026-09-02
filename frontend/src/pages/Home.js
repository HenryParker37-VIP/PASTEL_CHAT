import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLang } from '../i18n';
import TypewriterText from '../components/TypewriterText';
import NotificationButton from '../components/NotificationButton';
import LanguagePickerModal from '../components/LanguagePickerModal';
import OnboardingTutorial from '../components/OnboardingTutorial';
import PastelIcon from '../components/PastelIcon';

const TILES = [
  {
    icon: '/images/home-icons/change-name.png',
    key: 'profile',
    labelKey: 'homeChangeName',
    descKey: 'homeChangeNameDesc',
    path: '/profile',
    tone: 'profile',
  },
  {
    icon: '/images/home-icons/chat-friends.png',
    key: 'chat',
    labelKey: 'homeChatFriends',
    descKey: 'homeChatFriendsDesc',
    path: '/friends',
    tone: 'chat',
  },
  {
    icon: '/images/home-icons/group-chats.png',
    key: 'groups',
    labelKey: 'homeGroups',
    descKey: 'homeGroupsDesc',
    path: '/friends',
    tone: 'groups',
  },
  {
    icon: '/images/home-icons/shared-photos.png',
    key: 'photos',
    labelKey: 'homeSharedPhotos',
    descKey: 'homeSharedPhotosDesc',
    path: '/shared-photos',
    tone: 'photos',
  },
  {
    icon: '/images/home-icons/private-space.png',
    key: 'myspace',
    labelKey: 'homeMySpace',
    descKey: 'homeMySpaceDesc',
    path: '/my-space',
    tone: 'myspace',
  },
  {
    icon: '/images/home-icons/privacy-support.png',
    key: 'privacy',
    labelKey: 'homePrivacy',
    descKey: 'homePrivacyDesc',
    path: '/privacy',
    tone: 'privacy',
  },
];

const ReleaseNotesButton = ({ t, navigate }) => (
  <button type="button" className="btn btn-ghost" onClick={() => navigate('/whats-new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontSize: 12, color: '#7B5B95' }}>
    <PastelIcon name="sparkles" size={15} /> {t('releaseTitle')}
  </button>
);

const Home = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const { t, lang, setLang } = useLang();
  const [time, setTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 700);

  // Onboarding: show language picker → then tutorial on first login
  const [showLangPicker, setShowLangPicker] = useState(
    () => !localStorage.getItem('pastel_onboarding_done') && !localStorage.getItem('pastel_lang_chosen')
  );
  const [showTutorial, setShowTutorial] = useState(
    () => !localStorage.getItem('pastel_onboarding_done') && !!localStorage.getItem('pastel_lang_chosen')
  );

  const handleLangChosen = (code) => {
    setLang(code);
    localStorage.setItem('pastel_lang_chosen', '1');
    setShowLangPicker(false);
    setShowTutorial(true);
  };

  const handleTutorialDone = () => {
    setShowTutorial(false);
  };

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
            words={[t('homeWelcome', user?.name?.split(' ')[0] || 'friend'), t('homeWelcomeAlt'), 'Shall we chat?']}
            typingSpeed={80}
          />
        </div>

        {/* 2×3 App icon grid */}
        <div className="home-mobile-grid" data-tutorial="features">
          {TILES.map((tile, i) => (
            <button
              key={tile.key}
              className={`home-mobile-tile home-mobile-tile--${tile.tone} pop-in`}
              style={{ animationDelay: `${i * 0.06}s` }}
              onClick={() => navigate(tile.path)}
            >
              <span className="home-mobile-tile-icon-wrap">
                <img className="home-mobile-tile-icon" src={tile.icon} alt="" width="64" height="64" style={{ '--home-icon-delay': `${-i * 0.45}s` }} draggable="false" />
              </span>
              <span className="home-mobile-label">{t(tile.labelKey)}</span>
            </button>
          ))}
        </div>

        {/* User tier / login code section */}
        {user?.loginMethod === 'google' || user?.isGoogleVerified ? (
          <div className="home-mobile-code-wrap" style={{ background: 'linear-gradient(135deg,#E8F4FD,#EDE7FF)', borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {user.avatar && <img src={user.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #4285F4' }} />}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#4A4A4A' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: '#4285F4', fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center' }}><PastelIcon name="check" size={12} /> Google Verified</div>
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 16,
              background: 'linear-gradient(135deg, #4285F4, #34A853)',
              color: 'white', fontSize: 11, fontWeight: 700, marginBottom: 10
            }}>
              <PastelIcon name="shield-heart" size={12} /> Enhanced Security · Google OAuth
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <NotificationButton />
              <ReleaseNotesButton t={t} navigate={navigate} />
              <div data-tutorial="install" onClick={() => navigate('/install')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 20,
                background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 100%)',
                cursor: 'pointer'
              }}>
                <PastelIcon name="home" size={15} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{t('addToHomeScreen')}</span>
              </div>
            </div>
          </div>
        ) : user?.loginCode ? (
          <div className="home-mobile-code-wrap">
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4, textAlign: 'center' }}>
              <PastelIcon name="profile-edit" size={15} /> Standard Account · Code Login
            </div>
            <p className="home-mobile-code-hint">{t('homeLoginCode')}</p>
            <div className="code-display">{user.loginCode}</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
              <NotificationButton />
              <ReleaseNotesButton t={t} navigate={navigate} />
              <div data-tutorial="install" onClick={() => navigate('/install')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 20,
                background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 100%)',
                cursor: 'pointer'
              }}>
                <PastelIcon name="home" size={15} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{t('addToHomeScreen')}</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Time */}
        <p className="home-mobile-time">{time.toLocaleTimeString()}</p>

        {/* Onboarding: language picker → tutorial */}
        {showLangPicker && <LanguagePickerModal onSelect={handleLangChosen} />}
        {showTutorial && <OnboardingTutorial lang={lang} onComplete={handleTutorialDone} />}
      </div>
    );
  }

  // ── Desktop layout ────────────────────────────────────────────
  return (
    <div className="container">
      <div className="home-desktop-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img className="avatar sticker-wiggle" src={user?.avatar} alt="" />
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{user?.name}</p>
            <p style={{ margin: 0, fontSize: 12 }}>
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

      <div className="home-grid" data-tutorial="features">
        {TILES.map((tile, i) => (
          <div
            key={tile.key}
            className={`home-tile home-tile--${tile.tone} pop-in`}
            style={{ animationDelay: `${0.05 + i * 0.05}s` }}
            onClick={() => navigate(tile.path)}
          >
            <span className="home-tile-icon-wrap">
              <img className="home-tile-icon" src={tile.icon} alt="" width="80" height="80" style={{ '--home-icon-delay': `${-i * 0.45}s` }} draggable="false" />
            </span>
            <h3>{t(tile.labelKey)}</h3>
            <p>{t(tile.descKey)}</p>
          </div>
        ))}
      </div>

      {/* User tier indicator */}
      {user?.loginMethod === 'google' || user?.isGoogleVerified ? (
        <div className="card pop-in" style={{
          marginTop: 30, textAlign: 'center',
          background: 'linear-gradient(135deg, #E8F4FD 0%, #EDE7FF 100%)',
          border: '1.5px solid #C2D8F5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
            {user.avatar && <img src={user.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #4285F4' }} />}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#4A4A4A' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: '#4285F4', fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center' }}><PastelIcon name="check" size={12} /> Google Verified</div>
            </div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 20,
            background: 'linear-gradient(135deg, #4285F4, #34A853)',
            color: 'white', fontSize: 11, fontWeight: 700, marginBottom: 10
          }}>
            <PastelIcon name="shield-heart" size={12} /> Enhanced Security · Google OAuth
          </div>
          <div style={{ marginTop: 4, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <NotificationButton />
            <ReleaseNotesButton t={t} navigate={navigate} />
            <div
              data-tutorial="install"
              onClick={() => navigate('/install')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 20,
                background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 100%)',
                cursor: 'pointer', border: 'none'
              }}
            >
              <PastelIcon name="home" size={15} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{t('addToHomeScreen')}</span>
            </div>
          </div>
        </div>
      ) : user?.loginCode ? (
        <div className="card pop-in" style={{ marginTop: 30, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <PastelIcon name="profile-edit" size={20} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#4A4A4A' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: '#999' }}>Standard Security · Code Login</div>
            </div>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: '#888' }}>{t('homeLoginCode')}</p>
          <div className="code-display">{user.loginCode}</div>
          <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>{t('homeLoginCodeHint')}</p>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <NotificationButton />
            <ReleaseNotesButton t={t} navigate={navigate} />
            <div
              data-tutorial="install"
              onClick={() => navigate('/install')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 20,
                background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 100%)',
                cursor: 'pointer', border: 'none'
              }}
            >
              <PastelIcon name="home" size={15} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{t('addToHomeScreen')}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Onboarding: language picker → tutorial */}
      {showLangPicker && <LanguagePickerModal onSelect={handleLangChosen} />}
      {showTutorial && <OnboardingTutorial lang={lang} onComplete={handleTutorialDone} />}
    </div>
  );
};

export default Home;
