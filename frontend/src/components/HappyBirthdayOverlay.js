import React, { useEffect, useMemo } from 'react';

const COLORS = ['#FFB6C1', '#DDA0DD', '#ADD8E6', '#FFD700', '#98FB98', '#FFA07A', '#FF69B4', '#87CEEB', '#FFDAB9'];
const SHAPES = ['circle', 'square', 'triangle'];

const HappyBirthdayOverlay = ({ name, age, isOwn, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [onClose]);

  const pieces = useMemo(() => (
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      left: Math.random() * 100,
      delay: Math.random() * 4,
      duration: 4 + Math.random() * 4,
      size: 8 + Math.random() * 14,
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      rotate: Math.random() * 720
    }))
  ), []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1200, cursor: 'pointer'
      }}
    >
      {/* Confetti */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {pieces.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              top: '-30px',
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'square' ? '3px' : '0',
              clipPath: p.shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none',
              animation: `confetti-fall ${p.duration}s ${p.delay}s infinite ease-in`,
              transform: `rotate(${p.rotate}deg)`,
              opacity: 0.9
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          textAlign: 'center',
          padding: '44px 52px',
          background: 'linear-gradient(135deg, #FFB6C1 0%, #DDA0DD 50%, #ADD8E6 100%)',
          borderRadius: 32,
          boxShadow: '0 28px 80px rgba(0,0,0,0.35)',
          animation: 'pop-in 0.45s cubic-bezier(.68,-0.55,.27,1.55)',
          maxWidth: '90vw',
          position: 'relative', zIndex: 1
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 12, animation: 'float 2s ease-in-out infinite' }}>🎂</div>
        <h1 style={{
          color: 'white', fontSize: 38, fontWeight: 900,
          margin: '0 0 10px', textShadow: '0 3px 12px rgba(0,0,0,0.25)',
          letterSpacing: '-0.5px'
        }}>
          Happy Birthday!
        </h1>
        <h2 style={{
          color: 'white', fontSize: 26, fontWeight: 700,
          margin: '0 0 10px', textShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          {isOwn ? 'You' : `🌸 ${name}`}
        </h2>
        {age && (
          <p style={{
            color: 'rgba(255,255,255,0.95)', fontSize: 20,
            margin: '0 0 24px', fontWeight: 600
          }}>
            {isOwn
              ? `You turn ${age} today! 🥳`
              : `Turns ${age} today! 🥳`
            }
          </p>
        )}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8,
          flexWrap: 'wrap', marginBottom: 20
        }}>
          {['🎉', '🎈', '🎊', '✨', '🥳'].map((e, i) => (
            <span key={i} style={{ fontSize: 28, animation: `float ${1.5 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}>
              {e}
            </span>
          ))}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>
          Click anywhere to close · auto-closes in 12s
        </p>
      </div>
    </div>
  );
};

export default HappyBirthdayOverlay;
