import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLang } from '../i18n';
import TypewriterText from '../components/TypewriterText';

const Home = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const { t } = useLang();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
        <div className="home-tile pop-in" style={{ animationDelay: '0.05s' }} onClick={() => navigate('/profile')}>
          <span className="emoji float">🎨</span>
          <h3>{t('homeChangeName')}</h3>
          <p>{t('homeChangeNameDesc')}</p>
        </div>

        <div className="home-tile pop-in" style={{ animationDelay: '0.15s' }} onClick={() => navigate('/friends')}>
          <span className="emoji float" style={{ animationDelay: '0.2s' }}>💬</span>
          <h3>{t('homeChatFriends')}</h3>
          <p>{t('homeChatFriendsDesc')}</p>
        </div>

        <div className="home-tile pop-in" style={{ animationDelay: '0.2s' }} onClick={() => navigate('/friends')}>
          <span className="emoji float" style={{ animationDelay: '0.3s' }}>👥</span>
          <h3>{t('homeGroups')}</h3>
          <p>{t('homeGroupsDesc')}</p>
        </div>

        <div className="home-tile pop-in" style={{ animationDelay: '0.3s' }} onClick={() => navigate('/privacy')}>
          <span className="emoji float" style={{ animationDelay: '0.4s' }}>🔒</span>
          <h3>{t('homePrivacy')}</h3>
          <p>{t('homePrivacyDesc')}</p>
        </div>
      </div>

      {user?.loginCode && (
        <div className="card pop-in" style={{ marginTop: 30, textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: '#888' }}>{t('homeLoginCode')}</p>
          <div className="code-display">{user.loginCode}</div>
          <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>{t('homeLoginCodeHint')}</p>
        </div>
      )}
    </div>
  );
};

export default Home;
