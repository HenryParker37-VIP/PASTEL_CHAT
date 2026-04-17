import React from 'react';

const LoadingAnimation = ({ label = 'Loading messages...' }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    padding: '40px 20px'
  }}>
    {/* 3 bars that slide horizontally then rotate */}
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '90px',
      overflow: 'hidden',
      position: 'relative',
      height: '42px',
      justifyContent: 'center'
    }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: '4px',
            borderRadius: '4px',
            background: `linear-gradient(90deg, #FFB6C1, #DDA0DD, #ADD8E6)`,
            animation: 'bar-slide-rotate 1.8s ease-in-out infinite',
            animationDelay: `${i * 0.22}s`,
            transformOrigin: 'center center'
          }}
        />
      ))}
    </div>
    {label && (
      <span style={{
        fontSize: '13px',
        color: '#AAAAAA',
        fontWeight: 400,
        letterSpacing: '0.3px',
        animation: 'pulse 1.8s ease-in-out infinite'
      }}>
        {label}
      </span>
    )}
  </div>
);

export default LoadingAnimation;
