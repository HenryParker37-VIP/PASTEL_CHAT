import React, { useState, useEffect } from 'react';
import api from '../services/api';

const TelegramSetup = ({ onClose, onConnected }) => {
  const [step, setStep] = useState('intro'); // intro, connect, verifying, connected
  const [telegramUsername, setTelegramUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState({
    enableTelegramNotifications: true,
    enableTelegramCalls: true,
    enableTelegramMessages: true
  });

  useEffect(() => {
    checkTelegramStatus();
  }, []);

  const checkTelegramStatus = async () => {
    try {
      const { data } = await api.get('/api/telegram/status');
      if (data.connected && data.verified) {
        setStep('connected');
      }
    } catch (e) {
      console.error('Failed to check Telegram status:', e);
    }
  };

  const handleConnect = async () => {
    if (!telegramUsername.trim()) {
      setError('Please enter your Telegram username');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/api/telegram/connect', {
        telegramUsername: telegramUsername.trim()
      });

      setVerificationCode(data.verificationCode);
      setInstructions(data.instructions);
      setStep('connect');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to start Telegram connection');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!telegramUsername.trim()) {
      setError('Please enter a chat ID');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Chat ID can be obtained from the Telegram bot or extracted from username
      // For now, we'll extract it when user scans QR or completes verification
      const { data } = await api.post('/api/telegram/verify', {
        code: verificationCode,
        chatId: telegramUsername // This will be updated by webhook
      });

      setStep('verifying');
      // Wait a moment then transition to connected
      setTimeout(() => {
        setStep('connected');
        onConnected?.();
      }, 2000);
    } catch (e) {
      setError(e.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      await api.put('/api/telegram/preferences', preferences);
      setError('');
      onConnected?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save preferences');
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
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to disconnect');
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
        background: 'white',
        borderRadius: 16,
        padding: 24,
        maxWidth: 400,
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Intro Step */}
        {step === 'intro' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              📱 Telegram Notifications
            </h2>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>
              Get reliable notifications for incoming calls and messages, even when the app is closed. Telegram works great on iOS!
            </p>

            <div style={{
              background: '#f5f5f5',
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              fontSize: 13,
              lineHeight: 1.6
            }}>
              <strong>What you get:</strong>
              <ul style={{ marginLeft: 16, marginTop: 8 }}>
                <li>✅ Reliable notifications on iOS</li>
                <li>✅ Incoming call alerts</li>
                <li>✅ Message previews</li>
                <li>✅ Friend requests</li>
              </ul>
            </div>

            <input
              type="text"
              placeholder="@your_telegram_username"
              value={telegramUsername}
              onChange={(e) => {
                setTelegramUsername(e.target.value);
                setError('');
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 14,
                marginBottom: 16,
                boxSizing: 'border-box'
              }}
            />

            {error && (
              <div style={{ color: '#d32f2f', fontSize: 12, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onClose?.()}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  background: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Not now
              </button>
              <button
                onClick={handleConnect}
                disabled={loading || !telegramUsername.trim()}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: 8,
                  background: '#6366f1',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loading || !telegramUsername.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !telegramUsername.trim() ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {loading ? '...' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {/* Connect Step */}
        {step === 'connect' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
              ✓ Code ready
            </h2>

            <div style={{
              background: '#f0f4ff',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16
            }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                Verification code:
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: '#6366f1',
                letterSpacing: 4,
                marginBottom: 12
              }}>
                {verificationCode}
              </div>
              <div style={{
                fontSize: 12,
                color: '#666',
                lineHeight: 1.5
              }}>
                {instructions || 'Open Telegram and send the code above to complete verification'}
              </div>
            </div>

            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              Send the code to your Telegram bot, then tap the button below once you see the confirmation.
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setStep('intro');
                  setTelegramUsername('');
                  setVerificationCode('');
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  background: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
              <button
                onClick={handleVerify}
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
                {loading ? '...' : 'I sent the code'}
              </button>
            </div>
          </>
        )}

        {/* Verifying Step */}
        {step === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
              Verifying your Telegram connection...
            </p>
          </div>
        )}

        {/* Connected Step */}
        {step === 'connected' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✅</span> Connected!
            </h2>

            <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>
              You'll now receive notifications in Telegram for important events. Choose what notifications you want to receive:
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                cursor: 'pointer',
                fontSize: 13
              }}>
                <input
                  type="checkbox"
                  checked={preferences.enableTelegramNotifications}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    enableTelegramNotifications: e.target.checked
                  })}
                  style={{ cursor: 'pointer' }}
                />
                All notifications
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                cursor: 'pointer',
                fontSize: 13
              }}>
                <input
                  type="checkbox"
                  checked={preferences.enableTelegramCalls}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    enableTelegramCalls: e.target.checked
                  })}
                  style={{ cursor: 'pointer' }}
                />
                Incoming calls
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                cursor: 'pointer',
                fontSize: 13
              }}>
                <input
                  type="checkbox"
                  checked={preferences.enableTelegramMessages}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    enableTelegramMessages: e.target.checked
                  })}
                  style={{ cursor: 'pointer' }}
                />
                Messages & stickers
              </label>
            </div>

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
                {loading ? '...' : 'Save & close'}
              </button>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 16px',
                border: '1px solid #f44336',
                borderRadius: 8,
                background: 'white',
                color: '#f44336',
                fontSize: 13,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
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
