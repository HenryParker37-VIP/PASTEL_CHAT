import React from 'react';

const TypingIndicator = ({ typingUsers }) => {
  if (!typingUsers || typingUsers.length === 0) return null;

  const names = typingUsers.map((u) => u.name).join(', ');
  const label =
    typingUsers.length === 1
      ? `${names} is typing`
      : `${names} are typing`;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 16px 4px',
      animation: 'fadeIn 0.2s ease'
    }}>
      {/* Animated dots */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#DDA0DD',
              display: 'inline-block',
              animation: 'blink 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
      </div>
      <span style={{
        fontSize: '12px',
        color: '#AAAAAA',
        fontStyle: 'italic'
      }}>
        {label}...
      </span>
    </div>
  );
};

export default TypingIndicator;
