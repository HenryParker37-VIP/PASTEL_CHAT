import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useLang, LANGUAGES } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';

const Privacy = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();

  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notifyPref, setNotifyPref] = useState(() => {
    return localStorage.getItem('pastelchat.notify') === '1';
  });

  useEffect(() => {
    if (!notifyPref) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [notifyPref]);

  const toggleNotify = (val) => {
    setNotifyPref(val);
    localStorage.setItem('pastelchat.notify', val ? '1' : '0');
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
      <h2 style={{ margin: '4px 0 14px' }}>🔒 {t('homePrivacy')}</h2>

      {/* ── Appearance ── */}
      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>🎨 {t('privacyAppearance')}</h3>
        <p style={{ fontSize: 14, color: 'var(--text)', opacity: 0.65, marginBottom: 16 }}>
          {t('privacyAppearanceDesc')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{theme === 'dark' ? '🌙' : '☀️'}</span>
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
              <span>☀️</span>
              <span>🌙</span>
            </div>
            <div className="theme-toggle-thumb" />
          </label>
        </div>
      </div>

      {/* ── Language ── */}
      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>🌍 {t('privacyLanguage')}</h3>
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
              <span style={{ fontSize: 20 }}>{l.flag}</span>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notifications ── */}
      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>🔔 {t('privacyNotifications')}</h3>
        <p style={{ fontSize: 14, color: 'var(--text)', opacity: 0.65 }}>
          {t('privacyNotificationsDesc')}
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={notifyPref}
            onChange={(e) => toggleNotify(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span>{t('privacyNotificationsEnable')}</span>
        </label>
      </div>

      {/* ── What we store ── */}
      <div className="card pop-in" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>🛡️ {t('privacyWhatWeStore')}</h3>
        <ul style={{ fontSize: 14, color: 'var(--text)', opacity: 0.7, paddingLeft: 20 }}>
          <li>{t('privacyStore1')}</li>
          <li>{t('privacyStore2')}</li>
          <li>{t('privacyStore3')}</li>
        </ul>
        <p style={{ fontSize: 13, opacity: 0.5, margin: 0 }}>{t('privacyNoAds')}</p>
      </div>

      {/* ── Bug / Feature report ── */}
      <div className="card pop-in">
        <h3 style={{ marginTop: 0 }}>🐞 {t('privacyFeedbackTitle')}</h3>
        <p style={{ fontSize: 14, color: 'var(--text)', opacity: 0.65 }}>
          {t('privacyFeedbackDesc')}
        </p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div className="pop-in" style={{ fontSize: 50 }}>💌</div>
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
                  {tp === 'bug' ? '🐞 Bug' : tp === 'feature' ? '✨ Feature' : '💭 Feedback'}
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
