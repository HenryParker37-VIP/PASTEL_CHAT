import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const Header = () => {
  const { user, logout } = useAuth();
  const { onlineUsers, connected } = useSocket();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (d) =>
    d.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });

  const formatTime = (d) =>
    d.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

  const initials = (name) =>
    name ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      height: '60px',
      background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 50%, #ADD8E6 100%)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 100
    }}>
      {/* Left: back button + logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => navigate('/home')}
          title="Back to dashboard"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'rgba(255,255,255,0.2)',
            border: 'none', borderRadius: '12px',
            padding: '5px 10px', cursor: 'pointer',
            color: 'white', fontSize: '13px', fontWeight: 600,
            backdropFilter: 'blur(4px)',
            transition: 'background 0.2s',
            flexShrink: 0
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
        >
          ← <span className="back-label">Home</span>
        </button>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', backdropFilter: 'blur(4px)',
          flexShrink: 0
        }}>
          💬
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'white', lineHeight: 1.2 }}>
            Pastel Chat
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: connected ? '#4CAF50' : '#FFA0A0',
              flexShrink: 0
            }} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>
              {onlineUsers.length} online
            </span>
          </div>
        </div>
      </div>

      {/* DateTime */}
      <div className="header-datetime" style={{
        textAlign: 'center',
        color: 'white',
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)'
      }}>
        <div style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.5px' }}>
          {formatTime(now)}
        </div>
        <div style={{ fontSize: '11px', opacity: 0.85 }}>
          {formatDate(now)}
        </div>
      </div>

      {/* User menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(255,255,255,0.25)',
            border: 'none', borderRadius: '20px',
            padding: '6px 12px 6px 6px',
            cursor: 'pointer',
            transition: 'background 0.2s',
            backdropFilter: 'blur(4px)'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, color: '#4A4A4A'
            }}>
              {initials(user?.name)}
            </div>
          )}
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 500, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name?.split(' ')[0]}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '10px' }}>▼</span>
        </button>

        {showMenu && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: 'white', borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: '180px', overflow: 'hidden', zIndex: 200,
            animation: 'fadeIn 0.15s ease'
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0E8E8' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>{user?.name}</div>
              <div style={{ fontSize: '11px', color: '#AAAAAA', marginTop: '2px' }}>{user?.email}</div>
            </div>
            <button
              onClick={() => { setShowMenu(false); logout(); }}
              style={{
                width: '100%', padding: '12px 16px',
                background: 'none', border: 'none',
                textAlign: 'left', cursor: 'pointer',
                fontSize: '13px', color: '#FF6B6B',
                fontWeight: 500,
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#FFF5F5'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
