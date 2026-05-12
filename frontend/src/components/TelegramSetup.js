import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const TelegramSetup = ({ onClose, onConnected }) => {
  const [step, setStep] = useState('intro');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);
  const [preferences, setPreferences] = useState({
    enableTelegramNotifications: true,
    enableTelegramCalls: true,
    enableTelegramMessages: true
  });

  // Dark mode detection
  const isDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  const colors = {
    bg: isDark ? '#1a1a2e' : '#ffffff',
    text: isDark ? '#e0e0e0' : '#333333',
    secondaryText: isDark ? '#b0b0b0' : '#666666',
    inputBg: isDark ? '#2d2d44' : '#ffffff',
    inputBorder: isDark ? '#444466' : '#dddddd',
    inputText: isDark ? '#e0e0e0' : '#333333',
    codeBg: isDark ? '#0f1622' : '#f0f4ff',
    codeText: isDark ? '#6bdbff' : '#6366f1',
    listBg: isDark ? '#2d2d44' : '#f5f5f5',
    listText: isDark ? '#b0b0b0' : '#333333'
  };

  useEffect(() => {
    checkTelegramStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const checkTelegramStatus = async () => {
    try {
      const { data } = await api.get('/api/telegram/status');
      if (data.connected && data.verified) {
        setStep('connected');
        setPreferences(data.preferences || preferences);
      }
    } catch (e) {
      console.error('Failed to check Telegram status:', e.message);
    }
  };

  // Detect platform for install links
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const telegramInstallUrl = isIOS
    ? 'https://apps.apple.com/app/telegram-messenger/id686449807'
    : isAndroid
      ? 'https://play.google.com/store/apps/details?id=org.telegram.messenger'
      : 'https://telegram.org/';

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/telegram/connect', {
        telegramUsername: telegramUsername.trim() || 'unknown'
      });

      if (!response.data?.verificationCode) {
        throw new Error('Could not get verification code');
      }

      const code = response.data.verificationCode;
      setVerificationCode(code);

      // Open Telegram deep link — bot receives /start CODE automatically
      const deepLink = `https://t.me/PastelChat_Notification_bot?start=${code}`;
      window.open(deepLink, '_blank');

      // Start polling — auto-completes when bot processes the deep link
      setTimeout(() => startPollingVerification(), 500);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Could not connect to server. Is the backend running?';
      console.error('Connect error:', errorMsg, err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const startPollingVerification = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStep('verifying');

    let attempts = 0;
    const maxAttempts = 60; // 2 minutes at 2s intervals

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const response = await api.post('/api/telegram/verify');
        if (response.data?.verified) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          if (response.data?.preferences) {
            setPreferences(response.data.preferences);
          }
          setStep('connected');
        } else if (attempts >= maxAttempts) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setError('Verification timed out. Please try again.');
          setStep('connect');
        }
      } catch (err) {
        const msg = err.response?.data?.message || '';
        if (msg.includes('expired')) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setError('Code expired. Please start again.');
          setStep('intro');
          setVerificationCode('');
        }
      }
    }, 2000);
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    setError('');
    try {
      await api.put('/api/telegram/preferences', preferences);
      onConnected?.();
      onClose?.();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to save preferences';
      console.error('Preferences error:', errorMsg, err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Telegram? You won\'t receive notifications there.')) return;

    setLoading(true);
    try {
      await api.post('/api/telegram/disconnect');
      setStep('intro');
      setTelegramUsername('');
      setVerificationCode('');
      setError('');
      onClose?.();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to disconnect';
      console.error('Disconnect error:', errorMsg, err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: colors.bg,
        color: colors.text,
        borderRadius: 16,
        padding: 24,
        maxWidth: 400,
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {step === 'intro' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: colors.text }}>
              📱 Telegram Notifications
            </h2>
            <p style={{ fontSize: 14, color: colors.secondaryText, marginBottom: 16, lineHeight: 1.5 }}>
              Get reliable notifications for calls and messages, even when Pastel Chat is closed. Works great on iPhone!
            </p>

            <div style={{
              background: colors.listBg, borderRadius: 12, padding: 12,
              marginBottom: 20, fontSize: 13, lineHeight: 1.7, color: colors.listText
            }}>
              <div>📞 Incoming call alerts</div>
              <div>💬 Message previews</div>
              <div>👥 Friend requests</div>
              <div>✅ Works even when app is closed</div>
            </div>

            {error && (
              <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 12 }}>{error}</div>
            )}

            {/* Primary: one-tap connect */}
            <button
              onClick={handleConnect}
              disabled={loading}
              style={{
                width: '100%', padding: '13px 16px', border: 'none', borderRadius: 10,
                background: 'linear-gradient(135deg, #0088cc, #0055aa)',
                color: 'white', fontSize: 15, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, marginBottom: 10
              }}
            >
              {loading ? '⏳ Opening Telegram...' : '✈️ Connect with Telegram'}
            </button>

            {/* Secondary: get Telegram if not installed */}
            <a
              href={telegramInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', width: '100%', padding: '10px 16px',
                border: `1px solid ${colors.inputBorder}`, borderRadius: 10,
                background: 'transparent', color: colors.secondaryText,
                fontSize: 13, fontWeight: 500, textAlign: 'center',
                textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box'
              }}
            >
              {isIOS ? '🍎 Download Telegram on App Store' : isAndroid ? '🤖 Get Telegram on Google Play' : '📥 Download Telegram'}
            </a>

            <button
              onClick={() => onClose?.()}
              style={{
                width: '100%', padding: '8px 16px', border: 'none',
                borderRadius: 8, background: 'transparent',
                color: colors.secondaryText, fontSize: 13, cursor: 'pointer'
              }}
            >
              Not now
            </button>
          </>
        )}

        {step === 'connect' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: colors.text }}>
              ✓ Code ready
            </h2>

            <div style={{
              background: colors.codeBg,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 12, color: colors.secondaryText, marginBottom: 8 }}>
                Verification code:
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: colors.codeText,
                letterSpacing: 4,
                marginBottom: 12
              }}>
                {verificationCode}
              </div>
              <div style={{
                fontSize: 12,
                color: colors.secondaryText,
                lineHeight: 1.5
              }}>
                {instructions}
              </div>
            </div>

            <p style={{ fontSize: 13, color: colors.secondaryText, marginBottom: 16, lineHeight: 1.5 }}>
              Open Telegram, find <strong>@PastelChat_Notification_bot</strong>, and send the code above.
              The app will connect automatically.
            </p>

            <button
              onClick={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                setStep('intro');
                setTelegramUsername('');
                setVerificationCode('');
                setError('');
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 8,
                background: 'transparent',
                color: colors.secondaryText,
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              Back
            </button>
          </>
        )}

        {step === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: colors.text }}>
              Waiting for Telegram...
            </h2>
            <p style={{ fontSize: 14, color: colors.secondaryText, marginBottom: 20, lineHeight: 1.6 }}>
              Send this message to the bot in Telegram:
            </p>
            <div style={{
              background: colors.codeBg, borderRadius: 10, padding: '12px 20px',
              fontFamily: 'monospace', fontSize: 20, fontWeight: 700,
              color: colors.codeText, letterSpacing: 3, marginBottom: 16
            }}>
              /verify {verificationCode}
            </div>
            <p style={{ fontSize: 12, color: colors.secondaryText, marginBottom: 16 }}>
              The app will connect automatically once verified.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: colors.codeText,
                  animation: 'pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                  opacity: 0.7
                }} />
              ))}
            </div>
            {error && (
              <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 12 }}>{error}</div>
            )}
            <button
              onClick={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                setStep('intro');
                setVerificationCode('');
                setError('');
              }}
              style={{
                padding: '8px 20px', border: `1px solid ${colors.inputBorder}`,
                borderRadius: 8, background: 'transparent',
                color: colors.secondaryText, fontSize: 13, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'connected' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: colors.text }}>
              <span>✅</span> Connected!
            </h2>

            <p style={{ fontSize: 13, color: colors.secondaryText, marginBottom: 16, lineHeight: 1.5 }}>
              You'll now receive notifications in Telegram. Choose what to receive:
            </p>

            <div style={{ marginBottom: 16 }}>
              {[
                { key: 'enableTelegramNotifications', label: 'All notifications' },
                { key: 'enableTelegramCalls', label: 'Incoming calls' },
                { key: 'enableTelegramMessages', label: 'Messages & stickers' }
              ].map(pref => (
                <label key={pref.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: colors.text
                }}>
                  <input
                    type="checkbox"
                    checked={preferences[pref.key]}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      [pref.key]: e.target.checked
                    })}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                  {pref.label}
                </label>
              ))}
            </div>

            {error && (
              <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                onClick={handleSavePreferences}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: 8,
                  background: '#6366f1',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Saving...' : 'Done'}
              </button>
            </div>

            <button
              onClick={handleDisconnect}
              style={{
                width: '100%',
                padding: '8px 16px',
                border: 'none',
                borderRadius: 8,
                background: 'transparent',
                color: '#ff6b6b',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Disconnect Telegram
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TelegramSetup;
