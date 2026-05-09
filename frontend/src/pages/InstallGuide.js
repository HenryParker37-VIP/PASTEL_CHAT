import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n';

const InstallGuide = () => {
  const navigate = useNavigate();
  const { t } = useLang();
  const [platform, setPlatform] = useState('ios');

  const iosSteps = [
    {
      step: '1',
      title: 'Open in Safari',
      desc: 'Use Safari browser to open pastel-chat.vercel.app'
    },
    {
      step: '2',
      title: 'Tap Share',
      desc: 'Press the Share button (arrow pointing up from box)'
    },
    {
      step: '3',
      title: 'Add to Home Screen',
      desc: 'Scroll down and tap "Add to Home Screen"'
    },
    {
      step: '4',
      title: 'Confirm',
      desc: 'Name the app "Pastel Chat" and tap Add'
    }
  ];

  const androidSteps = [
    {
      step: '1',
      title: 'Open in Chrome',
      desc: 'Use Chrome browser to open pastel-chat.vercel.app'
    },
    {
      step: '2',
      title: 'Tap Menu',
      desc: 'Press the menu button (three vertical dots)'
    },
    {
      step: '3',
      title: 'Install App',
      desc: 'Tap "Install app" or "Add to home screen"'
    },
    {
      step: '4',
      title: 'Done',
      desc: 'The app will be added to your home screen'
    }
  ];

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
        <button
          onClick={() => setPlatform('ios')}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: platform === 'ios' ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : '#F5F5F5',
            border: 'none',
            borderRadius: 12,
            color: platform === 'ios' ? 'white' : '#666',
            fontWeight: platform === 'ios' ? 600 : 500,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🍎 {t('installIos')}
        </button>
        <button
          onClick={() => setPlatform('android')}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: platform === 'android' ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : '#F5F5F5',
            border: 'none',
            borderRadius: 12,
            color: platform === 'android' ? 'white' : '#666',
            fontWeight: platform === 'android' ? 600 : 500,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🤖 {t('installAndroid')}
        </button>
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
