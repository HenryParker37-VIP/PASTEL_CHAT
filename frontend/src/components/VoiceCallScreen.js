import React, { useState, useEffect } from 'react';
import { useCall } from '../contexts/CallContext';
import AvatarImg from './AvatarImg';

const formatDuration = (ms) => {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

const CallBtn = ({ icon, label, active, danger, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer'
    }}
  >
    <div style={{
      width: 60, height: 60, borderRadius: '50%',
      background: danger
        ? 'linear-gradient(135deg, #FF4444, #CC0000)'
        : active
          ? 'rgba(255,255,255,0.9)'
          : 'rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 26,
      boxShadow: danger ? '0 6px 20px rgba(255,68,68,0.5)' : '0 2px 8px rgba(0,0,0,0.2)',
      transition: 'transform 0.15s, background 0.2s',
      backdropFilter: 'blur(8px)'
    }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.transform = 'scale(1.08)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {icon}
    </div>
    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{label}</span>
  </button>
);

const VoiceCallScreen = () => {
  const { activeCall, remoteAudioRef, endCall, toggleMute, toggleSpeaker } = useCall();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeCall?.startTime) return;
    const t = setInterval(() => setElapsed(Date.now() - activeCall.startTime), 1000);
    return () => clearInterval(t);
  }, [activeCall?.startTime]);

  if (!activeCall || activeCall.callType !== 'voice') return null;
  const { peer, status, isMuted, isSpeaker } = activeCall;

  const statusText = {
    calling:    'Calling…',
    connecting: 'Connecting…',
    connected:  formatDuration(elapsed),
  }[status] || 'Connecting…';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'space-between',
      padding: '60px 32px 52px',
      background: 'linear-gradient(160deg, #1a1a2e 0%, #2d1b3d 50%, #1a2a3a 100%)'
    }}>
      {/* Hidden audio element for remote voice */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Peer info */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginBottom: 24, textTransform: 'uppercase' }}>
          Voice Call
        </div>

        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
          {status !== 'connected' && (
            <>
              <div style={{
                position: 'absolute', inset: -16, borderRadius: '50%',
                border: '2px solid rgba(255,182,193,0.3)',
                animation: 'voicePulse 2s ease-out infinite'
              }} />
              <div style={{
                position: 'absolute', inset: -32, borderRadius: '50%',
                border: '2px solid rgba(255,182,193,0.15)',
                animation: 'voicePulse 2s ease-out 0.4s infinite'
              }} />
            </>
          )}
          <AvatarImg
            src={peer?.avatar}
            alt={peer?.name}
            style={{ width: 110, height: 110, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.15)', display: 'block' }}
          />
        </div>

        <div style={{ fontSize: 26, fontWeight: 700, color: 'white', marginBottom: 8 }}>
          {peer?.name}
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums', minHeight: 22 }}>
          {statusText}
        </div>
      </div>

      {/* Controls */}
      <div>
        <div style={{ display: 'flex', gap: 28, justifyContent: 'center', marginBottom: 36 }}>
          <CallBtn
            icon={isMuted ? '🔇' : '🎙️'}
            label={isMuted ? 'Unmute' : 'Mute'}
            active={isMuted}
            onClick={toggleMute}
            disabled={status === 'calling'}
          />
          {/* Speaker button: active (white) = loudspeaker ON, inactive = earpiece mode */}
          <CallBtn
            icon={isSpeaker ? '🔊' : '🔈'}
            label={isSpeaker ? 'Speaker' : 'Earpiece'}
            active={isSpeaker}
            onClick={toggleSpeaker}
            disabled={status === 'calling'}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CallBtn icon="📵" label="End Call" danger onClick={endCall} />
        </div>
      </div>

      <style>{`
        @keyframes voicePulse {
          0%   { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default VoiceCallScreen;
