import React, { useEffect, useRef } from 'react';
import { useCall } from '../contexts/CallContext';
import AvatarImg from './AvatarImg';

const IncomingCallAlert = () => {
  const { incomingCall, answerCall, rejectCall } = useCall();
  const audioRef = useRef(null);

  useEffect(() => {
    if (!incomingCall) return;
    // Play a simple ring tone using Web Audio API
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let stopped = false;
    const ring = () => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
      setTimeout(ring, 1400);
    };
    ring();
    return () => { stopped = true; ctx.close(); };
  }, [incomingCall]);

  if (!incomingCall) return null;
  const { from, callType } = incomingCall;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 0 40px',
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.25s ease'
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: 28,
        padding: '28px 28px 24px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        color: 'white',
        textAlign: 'center',
        animation: 'slideUp 0.3s cubic-bezier(.2,.8,.2,1)'
      }}>
        {/* Pulsing ring around avatar */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 18 }}>
          <div style={{
            position: 'absolute', inset: -10,
            borderRadius: '50%',
            border: '2px solid rgba(255,182,193,0.4)',
            animation: 'ringPulse 1.5s ease-out infinite'
          }} />
          <div style={{
            position: 'absolute', inset: -20,
            borderRadius: '50%',
            border: '2px solid rgba(255,182,193,0.2)',
            animation: 'ringPulse 1.5s ease-out 0.3s infinite'
          }} />
          <AvatarImg
            src={from.avatar}
            alt={from.name}
            style={{ width: 80, height: 80, borderRadius: '50%', display: 'block', border: '3px solid rgba(255,255,255,0.2)' }}
          />
        </div>

        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4, letterSpacing: '0.05em' }}>
          Incoming {callType === 'video' ? '📹 Video' : '📞 Voice'} Call
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 28 }}>{from.name}</div>

        <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
          {/* Reject */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <button
              onClick={rejectCall}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#FF4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, boxShadow: '0 6px 20px rgba(255,68,68,0.5)',
                transition: 'transform 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >📵</button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Decline</span>
          </div>

          {/* Answer */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <button
              onClick={answerCall}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, boxShadow: '0 6px 20px rgba(76,175,80,0.5)',
                transition: 'transform 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >{callType === 'video' ? '📹' : '📞'}</button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Answer</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(60px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default IncomingCallAlert;
