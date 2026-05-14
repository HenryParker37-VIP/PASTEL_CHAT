import React from 'react';

const UserProfile = ({ user, compact = false }) => {
  if (!user) return null;

  const isGoogle = user.loginMethod === 'google' || user.isGoogleVerified;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0
          }}>
            {(user.name || '?')[0].toUpperCase()}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#4A4A4A' }}>{user.name}</div>
          <div style={{ fontSize: 11, color: isGoogle ? '#4285F4' : '#999' }}>
            {isGoogle ? '🔐 Google Verified' : '👤 Standard'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-profile" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '20px 16px', textAlign: 'center'
    }}>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            style={{
              width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
              border: isGoogle ? '3px solid #4285F4' : '3px solid #FFB6C1'
            }}
          />
        ) : (
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 700, color: 'white'
          }}>
            {(user.name || '?')[0].toUpperCase()}
          </div>
        )}
        {isGoogle && (
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 22, height: 22, borderRadius: '50%',
            background: 'white', border: '2px solid #4285F4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12
          }}>
            G
          </div>
        )}
      </div>

      <h3 style={{ margin: '0 0 6px', fontSize: 18, color: '#4A4A4A' }}>{user.name}</h3>

      {isGoogle ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 12px', borderRadius: 20,
          background: 'linear-gradient(135deg, #E8F4FD, #EDE7FF)',
          color: '#4285F4', fontSize: 12, fontWeight: 700
        }}>
          🔐 Google Verified
        </span>
      ) : (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 12px', borderRadius: 20,
          background: '#F5F5F5', color: '#999', fontSize: 12, fontWeight: 600
        }}>
          👤 Standard Account
        </span>
      )}

      {user.bio && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#888', maxWidth: 240 }}>{user.bio}</p>
      )}
    </div>
  );
};

export default UserProfile;
