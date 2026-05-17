import React, { useEffect, useState } from 'react';

const LanguagePickerModal = ({ onSelect }) => {
  const [detected, setDetected] = useState(null);

  useEffect(() => {
    const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    const isVi = browserLang.startsWith('vi') || browserLang.includes('-vn');
    setDetected(isVi ? 'vi' : 'en');
  }, []);

  const isViRecommended = detected === 'vi';

  const opts = [
    {
      code: 'vi',
      flag: '🇻🇳',
      label: 'Tiếng Việt',
      sub: 'Vietnamese',
      rec: isViRecommended,
    },
    {
      code: 'en',
      flag: '🇬🇧',
      label: 'English',
      sub: 'English',
      rec: !isViRecommended,
    },
  ];

  // Put recommended first
  const sorted = isViRecommended ? opts : [...opts].reverse();

  return (
    <div
      className="backdrop-in"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8,6,20,0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9500,
        padding: 20,
      }}
    >
      <div
        className="modal-in"
        style={{
          background: 'linear-gradient(160deg, #1e1a35 0%, #251f3e 100%)',
          border: '1.5px solid rgba(221,160,221,0.25)',
          borderRadius: 26,
          padding: '36px 30px 28px',
          width: 'min(360px, 92vw)',
          boxShadow: '0 28px 72px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
          textAlign: 'center',
        }}
      >
        {/* Logo / greeting */}
        <div style={{ fontSize: 48, marginBottom: 10, animation: 'float 3s ease-in-out infinite' }}>🌸</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#f5eeff' }}>
          Welcome to Pastel Chat
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#9b87bb' }}>
          Chọn ngôn ngữ / Choose your language
        </p>

        {/* Language options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(({ code, flag, label, sub, rec }) => (
            <button
              key={code}
              onClick={() => onSelect(code)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 18px',
                background: rec ? 'rgba(255,182,193,0.12)' : 'rgba(255,255,255,0.05)',
                border: rec
                  ? '1.5px solid rgba(255,182,193,0.45)'
                  : '1.5px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                fontFamily: 'inherit',
                transition: 'all 0.18s',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 30, lineHeight: 1 }}>{flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f5eeff' }}>{label}</div>
                <div style={{ fontSize: 12, color: '#9b87bb' }}>{sub}</div>
              </div>
              {rec && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
                  color: 'white',
                  padding: '3px 9px', borderRadius: 20,
                  letterSpacing: '0.06em',
                  flexShrink: 0,
                }}>
                  ⭐ {code === 'vi' ? 'Gợi ý' : 'Recommended'}
                </span>
              )}
            </button>
          ))}
        </div>

        <p style={{ margin: '18px 0 0', fontSize: 11, color: '#4a3a60' }}>
          You can change language anytime in Settings
        </p>
      </div>
    </div>
  );
};

export default LanguagePickerModal;
