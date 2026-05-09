import React, { useState, useEffect } from 'react';
import { useCall } from '../contexts/CallContext';

const formatDuration = (ms) => {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

const CtrlBtn = ({ icon, label, active, danger, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer' }}
  >
    <div style={{
      width: 52, height: 52, borderRadius: '50%',
      background: danger
        ? 'linear-gradient(135deg, #FF4444, #CC0000)'
        : active ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22,
      boxShadow: danger ? '0 6px 20px rgba(255,68,68,0.5)' : '0 2px 10px rgba(0,0,0,0.3)',
      transition: 'transform 0.15s'
    }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.transform = 'scale(1.1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >{icon}</div>
    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{label}</span>
  </button>
);

const VideoCallScreen = () => {
  const { activeCall, localVideoRef, remoteVideoRef, endCall, toggleMute, toggleSpeaker, toggleCamera } = useCall();
  const [elapsed, setElapsed] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = React.useRef(null);

  useEffect(() => {
    if (!activeCall?.startTime) return;
    const t = setInterval(() => setElapsed(Date.now() - activeCall.startTime), 1000);
    return () => clearInterval(t);
  }, [activeCall?.startTime]);

  const handleTouch = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  };

  useEffect(() => {
    if (activeCall?.status === 'connected') {
      hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
    return () => clearTimeout(hideTimer.current);
  }, [activeCall?.status]);

  if (!activeCall || activeCall.callType !== 'video') return null;
  const { peer, status, isMuted, isSpeaker, isCameraOff } = activeCall;

  return (
    <div
      onClick={handleTouch}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column'
      }}
    >
      {/* Remote video — fills screen */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Placeholder when connecting */}
      {status !== 'connected' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(160deg, #1a1a2e, #2d1b3d)',
          zIndex: 1
        }}>
          <img src={peer?.avatar} alt="" style={{ width: 90, height: 90, borderRadius: '50%', marginBottom: 16, border: '3px solid rgba(255,255,255,0.2)' }} />
          <div style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{peer?.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
            {status === 'calling' ? 'Calling…' : 'Connecting video…'}
          </div>
        </div>
      )}

      {/* Local video — picture-in-picture */}
      <div style={{
        position: 'absolute', top: 60, right: 16, zIndex: 10,
        width: 100, height: 140,
        borderRadius: 14,
        overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        background: '#111'
      }}>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
        {isCameraOff && (
          <div style={{
            position: 'absolute', inset: 0, background: '#222',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: 'rgba(255,255,255,0.4)'
          }}>📷</div>
        )}
      </div>

      {/* Top bar — peer name + timer */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '16px 20px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.3s'
      }}>
        <img src={peer?.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{peer?.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            {status === 'connected' ? formatDuration(elapsed) : (status === 'calling' ? 'Calling…' : 'Connecting…')}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        padding: '20px 28px 44px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.3s'
      }}>
        <CtrlBtn icon={isCameraOff ? '📷' : '📸'} label={isCameraOff ? 'Camera off' : 'Camera'} active={isCameraOff} onClick={toggleCamera} disabled={status === 'calling'} />
        <CtrlBtn icon={isMuted ? '🔇' : '🎙️'} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted} onClick={toggleMute} disabled={status === 'calling'} />
        <CtrlBtn icon="📵" label="End" danger onClick={endCall} />
        <CtrlBtn icon={isSpeaker ? '🔊' : '🔈'} label={isSpeaker ? 'Speaker' : 'Earpiece'} active={isSpeaker} onClick={toggleSpeaker} disabled={status === 'calling'} />
        <CtrlBtn icon="🔄" label="Flip" onClick={() => {}} disabled={status === 'calling'} />
      </div>
    </div>
  );
};

export default VideoCallScreen;
