import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n';

const PRODUCTION_URL = 'https://pastel-chat.onrender.com';

const platformButtonStyle = {
  flex: 1,
  minHeight: 48,
  padding: '12px 16px',
  border: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  transition: 'all 0.2s',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.2,
  WebkitTapHighlightColor: 'transparent'
};

const platformIconStyle = {
  width: 20,
  height: 20,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 20px'
};

const appleIconStyle = {
  fontSize: 22,
  lineHeight: 1,
  transform: 'translateY(-1px)'
};

const androidIconStyle = {
  width: 18,
  height: 18,
  objectFit: 'contain',
  display: 'block'
};

const PlatformButton = ({ active, onClick, icon, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    style={{
      ...platformButtonStyle,
      background: active ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : '#F5F5F5',
      color: active ? 'white' : '#666'
    }}
  >
    <span style={platformIconStyle} aria-hidden="true">{icon}</span>
    <span>{children}</span>
  </button>
);

const InstallGuide = () => {
  const navigate = useNavigate();
  const { t } = useLang();
  const [platform, setPlatform] = useState('ios');

  const iosSteps = t('installIosSteps', PRODUCTION_URL);
  const androidSteps = t('installAndroidSteps', PRODUCTION_URL);

  const steps = platform === 'ios' ? iosSteps : androidSteps;

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>
        {t('back')}
      </button>
      <h2 style={{ margin: '4px 0 8px' }}>{t('installTitle')}</h2>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>{t('installSubtitle')}</p>

      {/* Platform selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <PlatformButton
          active={platform === 'ios'}
          onClick={() => setPlatform('ios')}
          icon={<span style={appleIconStyle}></span>}
        >
          {t('installIos')}
        </PlatformButton>
        <PlatformButton
          active={platform === 'android'}
          onClick={() => setPlatform('android')}
          icon={<img src="/images/android-logo.png?v=2" alt="" style={androidIconStyle} />}
        >
          {t('installAndroid')}
        </PlatformButton>
      </div>

      {/* Steps */}
      <div style={{ display: 'grid', gap: 16 }}>
        {steps.map((item, idx) => (
          <div key={idx} className="card" style={{ display: 'flex', gap: 16 }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 20,
              flexShrink: 0
            }}>
              {item.step}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15 }}>{item.title}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Success message */}
      <div className="card pop-in" style={{ marginTop: 28, textAlign: 'center', background: '#F0F8F0' }}>
        <p style={{ margin: 0, color: '#4CAF50', fontWeight: 600 }}>✓ {t('installDone')}</p>
      </div>
    </div>
  );
};

export default InstallGuide;
