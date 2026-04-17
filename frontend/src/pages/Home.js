import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import TypewriterText from '../components/TypewriterText';

const Home = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img className="avatar sticker-wiggle" src={user?.avatar} alt="" />
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{user?.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
              <span className={`status-pulse`} style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: connected ? '#7bd389' : '#ccc', marginRight: 6
              }} />
              {connected ? 'Connected' : 'Connecting...'} · {time.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={logout}>Log out</button>
      </div>

      <div className="hero">
        <h1>
          <TypewriterText
            words={[`Hi ${user?.name || 'friend'}!`, 'Welcome back ✿', 'Shall we chat?']}
            typingSpeed={80}
          />
        </h1>
        <p className="tagline">Pick what to do today:</p>
      </div>

      <div className="home-grid">
        <div className="home-tile pop-in" style={{ animationDelay: '0.05s' }} onClick={() => navigate('/profile')}>
          <span className="emoji float">🎨</span>
          <h3>Change name</h3>
          <p>Update your name, login code, and sticker face.</p>
        </div>

        <div className="home-tile pop-in" style={{ animationDelay: '0.15s' }} onClick={() => navigate('/friends')}>
          <span className="emoji float" style={{ animationDelay: '0.2s' }}>💬</span>
          <h3>Chat with friends</h3>
          <p>Add friends by code, give them a nickname, start private chats.</p>
        </div>

        <div className="home-tile pop-in" style={{ animationDelay: '0.25s' }} onClick={() => navigate('/privacy')}>
          <span className="emoji float" style={{ animationDelay: '0.4s' }}>🔒</span>
          <h3>Privacy & support</h3>
          <p>Notifications, reports, and help from the creator.</p>
        </div>
      </div>

      {user?.loginCode && (
        <div className="card pop-in" style={{ marginTop: 30, textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: '#888' }}>Your login code</p>
          <div className="code-display">{user.loginCode}</div>
          <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>Keep this safe — it's how you get back in.</p>
        </div>
      )}
    </div>
  );
};

export default Home;
