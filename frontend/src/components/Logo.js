import React from 'react';

const Logo = ({ size = 36, showName = false, nameStyle = {} }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <img
      src="/icons/icon.svg"
      alt="Pastel Chat"
      width={size}
      height={size}
      style={{ borderRadius: size * 0.22, flexShrink: 0 }}
    />
    {showName && (
      <span style={{
        fontWeight: 800,
        fontSize: 18,
        background: 'linear-gradient(90deg, #FFB6C1, #DDA0DD, #ADD8E6)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        letterSpacing: '-0.3px',
        ...nameStyle
      }}>
        PastelChat
      </span>
    )}
  </div>
);

export default Logo;
