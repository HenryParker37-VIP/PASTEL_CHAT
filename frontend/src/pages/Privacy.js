import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useLang, LANGUAGES } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import {
  isPushSupported,
  isIOS,
  isStandalonePWA,
  getNotificationPermission,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestNotification
} from '../services/push';
import PastelIcon from '../components/PastelIcon';

const Privacy = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();

  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Push notification state
  const [pushSupported, setPushSupported] = useState(true);
  const [pushPermission, setPushPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState({ type: '', text: '' });
  const [iosNonStandalone, setIosNonStandalone] = useState(false);

  const checkPushState = useCallback(async () => {
    const supported = isPushSupported();
    setPushSupported(supported);

    if (isIOS() && !isStandalonePWA()) {
      setIosNonStandalone(true);
    } else {
      setIosNonStandalone(false);
    }

    const perm = getNotificationPermission();
    setPushPermission(perm);

    if (supported && perm === 'granted') {
      const sub = await getExistingSubscription();
      setIsSubscribed(Boolean(sub));
    } else {
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    checkPushState();
  }, [checkPushState]);

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushStatusMsg({ type: '', text: '' });
    try {
      const result = await subscribeToPush();
      if (result.success) {
        setIsSubscribed(true);
        setPushPermission('granted');
        setPushStatusMsg({ type: 'success', text: t('privacyNotificationsEnabled') });
      } else {
        setPushPermission(result.permission || getNotificationPermission());
        setPushStatusMsg({ type: 'error', text: result.error || 'Failed to enable notifications' });
      }
    } catch (err) {
      setPushStatusMsg({ type: 'error', text: err.message || 'Error subscribing' });
    } finally {
      setPushBusy(false);
      checkPushState();
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    setPushStatusMsg({ type: '', text: '' });
    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
      setPushStatusMsg({ type: 'info', text: 'Notifications disabled on this device.' });
    } catch (err) {
      setPushStatusMsg({ type: 'error', text: err.message });
    } finally {
      setPushBusy(false);
      checkPushState();
    }
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushStatusMsg({ type: '', text: '' });
    try {
      await sendTestNotification();
      setPushStatusMsg({ type: 'success', text: t('privacyNotificationsTestSuccess') });
    } catch (err) {
      setPushStatusMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Failed to send test push' });
    } finally {
      setPushBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!message.trim()) return setError(t('privacyFeedbackEmpty'));
    setBusy(true);
    try {
      await api.post('/feedback', { type, message: message.trim() });
      setSent(true);
      setMessage('');
    } catch (err) {
      setError(err.response?.data?.message || t('privacyFeedbackError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>
        {t('back')}
      </button>
      <h2 style={{ margin: '4px 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}><PastelIcon name="shield-heart" size={25} /> {t('homePrivacy')}</h2>

      {/* ── Appearance ── */}
      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><PastelIcon name="palette" size={20} /> {t('privacyAppearance')}</h3>
        <p style={{ fontSize: 14, color: 'var(--text)', opacity: 0.65, marginBottom: 16 }}>
          {t('privacyAppearanceDesc')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PastelIcon name={theme === 'dark' ? 'moon' : 'sun'} size={22} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              {theme === 'dark' ? t('privacyDark') : t('privacyLight')}
            </span>
          </div>
          <label className="theme-toggle" title={t('privacyToggleTheme')}>
            <input
              type="checkbox"
              checked={theme === 'dark'}
              onChange={toggleTheme}
            />
            <div className="theme-toggle-track">
              <PastelIcon name="sun" size={14} />
              <PastelIcon name="moon" size={14} />
            </div>
            <div className="theme-toggle-thumb" />
          </label>
        </div>
      </div>

      {/* ── Language ── */}
      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><PastelIcon name="globe" size={20} /> {t('privacyLanguage')}</h3>
        <p style={{ fontSize: 14, color: 'var(--text)', opacity: 0.65, marginBottom: 16 }}>
          {t('privacyLanguageDesc')}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`lang-btn${lang === l.code ? ' active' : ''}`}
              onClick={() => setLang(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Push Notifications ── */}
      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PastelIcon name="bell" size={20} /> {t('privacyNotifications')}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text)', opacity: 0.7, marginBottom: 16 }}>
          {t('privacyNotificationsDesc')}
        </p>

        {/* iOS Non-Standalone Warning */}
        {iosNonStandalone && (
          <div style={{
            background: 'linear-gradient(135deg, #FFF0F5, #EDE7FF)',
            border: '1.5px solid #DDA0DD',
            borderRadius: 14,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#9B59B6', marginBottom: 4 }}>
              <PastelIcon name="home" size={16} /> iPhone / iPad Setup
            </div>
            <p style={{ margin: '0 0 10px', color: '#555', lineHeight: 1.4 }}>
              {t('privacyNotificationsIosHint')}
            </p>
            <button
              className="btn btn-lavender"
              style={{ fontSize: 12, padding: '5px 14px' }}
              onClick={() => navigate('/install')}
            >
              {t('privacyNotificationsIosGuide')}
            </button>
          </div>
        )}

        {/* Status display */}
        {!pushSupported ? (
          <div style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(230,230,230,0.5)',
            color: '#888',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <PastelIcon name="alert" size={16} />
            <span>{t('privacyNotificationsUnsupported')}</span>
          </div>
        ) : pushPermission === 'denied' ? (
          <div style={{
            padding: '12px 16px',
            borderRadius: 14,
            background: 'rgba(255, 143, 163, 0.12)',
            border: '1.5px solid #FF8FA3',
            fontSize: 13,
            color: '#D9534F'
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PastelIcon name="alert" size={16} />
              <span>{t('privacyNotificationsDenied')}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>
              {t('privacyNotificationsDeniedHint')}
            </p>
          </div>
        ) : isSubscribed ? (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(79, 168, 101, 0.12)',
              border: '1.5px solid #4fa865',
              color: '#2e7d32',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 14
            }}>
              <PastelIcon name="check" size={16} />
              <span>{t('privacyNotificationsEnabled')}</span>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn"
                onClick={handleTestPush}
                disabled={pushBusy}
                style={{ fontSize: 13, padding: '7px 16px' }}
              >
                {pushBusy ? t('loading') : <><PastelIcon name="bell" size={15} /> {t('privacyNotificationsTestBtn')}</>}
              </button>

              <button
                className="btn btn-ghost"
                onClick={handleDisablePush}
                disabled={pushBusy}
                style={{ fontSize: 13, padding: '7px 16px' }}
              >
                {t('privacyNotificationsDisableBtn')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              className="btn"
              onClick={handleEnablePush}
              disabled={pushBusy}
              style={{
                fontSize: 14,
                padding: '9px 20px',
                background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
                boxShadow: '0 4px 14px rgba(221,160,221,0.3)'
              }}
            >
              {pushBusy ? t('loading') : <><PastelIcon name="bell" size={16} /> {t('privacyNotificationsEnableBtn')}</>}
            </button>
          </div>
        )}

        {pushStatusMsg.text && (
          <p style={{
            fontSize: 13,
            margin: '12px 0 0',
            color: pushStatusMsg.type === 'error' ? '#e57373' : pushStatusMsg.type === 'success' ? '#4fa865' : '#888'
          }}>
            {pushStatusMsg.text}
          </p>
        )}
      </div>

      {/* ── Replay tutorial ── */}
      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><PastelIcon name="flip" size={20} /> {t('tutorialReplay')}</h3>
        <p style={{ fontSize: 14, color: 'var(--text)', opacity: 0.65, marginBottom: 14 }}>
          {t('tutorialReplayDesc')}
        </p>
        <button
          onClick={() => {
            localStorage.removeItem('pastel_onboarding_done');
            localStorage.removeItem('pastel_lang_chosen');
            navigate('/home');
          }}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
            border: 'none', borderRadius: 12,
            color: 'white', fontWeight: 700,
            fontSize: 14, cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(221,160,221,0.35)',
          }}
        >
          {t('tutorialReplayBtn')}
        </button>
      </div>

      {/* ── What we store ── */}
      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><PastelIcon name="shield-heart" size={20} /> {t('privacyWhatWeStore')}</h3>
        <ul style={{ fontSize: 14, color: 'var(--text)', opacity: 0.7, paddingLeft: 20 }}>
          <li>{t('privacyStore1')}</li>
          <li>{t('privacyStore2')}</li>
          <li>{t('privacyStore3')}</li>
        </ul>
        <p style={{ fontSize: 13, opacity: 0.5, margin: 0 }}>{t('privacyNoAds')}</p>
      </div>

      {/* ── Bug / Feature report ── */}
      <div className="card pop-in">
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><PastelIcon name="chat-friends" size={20} /> {t('privacyFeedbackTitle')}</h3>
        <p style={{ fontSize: 14, color: 'var(--text)', opacity: 0.65 }}>
          {t('privacyFeedbackDesc')}
        </p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div className="pop-in" style={{ color: '#C875A8' }}><PastelIcon name="send" size={50} title="Feedback sent" /></div>
            <p style={{ fontWeight: 700 }}>{t('privacyFeedbackSent')}</p>
            <button className="btn btn-ghost" onClick={() => setSent(false)}>{t('privacyFeedbackAnother')}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['bug', 'feature', 'feedback'].map((tp) => (
                <button
                  type="button"
                  key={tp}
                  onClick={() => setType(tp)}
                  className={`btn ${type === tp ? '' : 'btn-ghost'}`}
                  style={{ flex: 1, textTransform: 'capitalize' }}
                >
                  <PastelIcon name={tp === 'bug' ? 'alert' : tp === 'feature' ? 'gift' : 'chat-friends'} size={16} /> {tp === 'bug' ? 'Bug' : tp === 'feature' ? 'Feature' : 'Feedback'}
                </button>
              ))}
            </div>
            <textarea
              className="input"
              style={{ borderRadius: 16, minHeight: 120, padding: 14, resize: 'vertical' }}
              placeholder={t('privacyFeedbackPlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
            />
            {error && <p style={{ color: '#e57373', fontSize: 13, margin: 0 }}>{error}</p>}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? t('privacyFeedbackSending') : t('privacyFeedbackSend')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Privacy;
