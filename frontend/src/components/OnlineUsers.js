import React from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const initials = (name) =>
  name ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';

const OnlineUsers = () => {
  const { onlineUsers } = useSocket();
  const { user } = useAuth();

  return (
    <aside style={{
      width: '220px',
      minWidth: '220px',
      background: 'white',
      borderRight: '1px solid #EEE0D8',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid #EEE0D8',
        flexShrink: 0
      }}>
        <h3 style={{
          fontSize: '12px',
          fontWeight: 700,
          color: '#AAAAAA',
          textTransform: 'uppercase',
          letterSpacing: '0.8px'
        }}>
          Online — {onlineUsers.length}
        </h3>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
        {onlineUsers.length === 0 ? (
          <p style={{
            padding: '16px',
            fontSize: '13px',
            color: '#CCCCCC',
            textAlign: 'center'
          }}>
            No one online
          </p>
        ) : (
          onlineUsers.map((u) => (
            <div
              key={u._id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 16px',
                transition: 'background 0.15s',
                background: u._id === user?._id ? 'rgba(255,182,193,0.1)' : 'transparent'
              }}
              onMouseEnter={e => { if (u._id !== user?._id) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = u._id === user?._id ? 'rgba(255,182,193,0.1)' : 'transparent'; }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {u.avatar ? (
                  <img
                    src={u.avatar}
                    alt={u.name}
                    style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: 'white'
                  }}>
                    {initials(u.name)}
                  </div>
                )}
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: '#4CAF50', border: '2px solid white'
                }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: '13px', fontWeight: 600, color: '#4A4A4A',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {u._id === user?._id ? 'You' : u.name}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

export default OnlineUsers;
