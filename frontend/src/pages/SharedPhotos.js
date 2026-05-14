import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';
import PhotoUpload from '../components/PhotoUpload';

const TIMER_OPTIONS = [0, 3, 5, 10];

function makeBeep(ctx, freq = 880, duration = 0.08) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

const SharedPhotos = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const countdownRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('user');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Countdown timer
  const [timerMode, setTimerMode] = useState(0); // seconds; 0 = off
  const [countdown, setCountdown] = useState(null); // null = idle, number = counting
  const [togglingPhotoId, setTogglingPhotoId] = useState(null);

  const isGoogleUser = user?.loginMethod === 'google' || user?.isGoogleVerified;

  const handleToggleVisibility = useCallback(async (photo, e) => {
    e.stopPropagation();
    if (togglingPhotoId) return;
    setTogglingPhotoId(photo._id);
    try {
      const newHidden = !photo.isHidden;
      await api.post(`/private-space/shared-photos/${photo._id}/toggle-visibility`, { isHidden: newHidden });
      setPhotos(prev => prev.map(p => p._id === photo._id ? { ...p, isHidden: newHidden } : p));
      if (selectedPhoto?._id === photo._id) {
        setSelectedPhoto(prev => ({ ...prev, isHidden: newHidden }));
      }
    } catch {
      // silently ignore
    } finally {
      setTogglingPhotoId(null);
    }
  }, [togglingPhotoId, selectedPhoto]);

  const startCamera = useCallback(async (mode) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setCameraReady(false);
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setCameraError('Camera not available. Allow camera access and try again.');
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, startCamera]);

  // Load persisted photos on mount
  useEffect(() => {
    setLoading(true);
    api.get('/private-space/shared-photos')
      .then(res => setPhotos(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Real-time incoming photos via Socket.io
  useEffect(() => {
    if (!socket || !user) return;
    const event = `new_photo_shared:${user._id}`;
    const handler = (photo) => {
      setPhotos(prev => {
        if (prev.find(p => p._id === photo._id)) return prev;
        return [photo, ...prev].slice(0, 50);
      });
    };
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, user]);

  const capturePhoto = useCallback(() => {
    if (!cameraReady || !videoRef.current || sending) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

    setFlash(true);
    setTimeout(() => setFlash(false), 250);

    setSending(true);
    socket.emit('share_photo', { dataUrl, caption: '' });
    setTimeout(() => setSending(false), 800);
  }, [cameraReady, sending, facingMode, socket]);

  const handleShutterPress = () => {
    if (!cameraReady || sending || countdown !== null) return;

    if (timerMode === 0) {
      capturePhoto();
      return;
    }

    // Start countdown
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    let remaining = timerMode;
    setCountdown(remaining);

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        makeBeep(ctx, 660, 0.1);
        setCountdown(remaining);
      } else {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        makeBeep(ctx, 1047, 0.18); // higher final beep
        setCountdown(null);
        capturePhoto();
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  };

  const flipCamera = () => {
    cancelCountdown();
    setFacingMode(m => (m === 'user' ? 'environment' : 'user'));
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      height: '100dvh', background: '#0d0d0d',
      paddingTop: 'env(safe-area-inset-top)'
    }}>
      {/* Constrained column — stays phone-width on iPad */}
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', flexShrink: 0
        }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20,
              color: 'white', fontSize: 13, fontWeight: 600, padding: '6px 14px', cursor: 'pointer'
            }}
          >← Back</button>
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>📸 Shared Photos</span>
            {isGoogleUser && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>🔐 Premium · Photo encryption enabled</div>
            )}
          </div>
          <button
            onClick={flipCamera}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20,
              color: 'white', fontSize: 13, fontWeight: 600, padding: '6px 14px', cursor: 'pointer'
            }}
          >🔄 Flip</button>
        </div>

        {/* Camera viewfinder */}
        <div style={{
          position: 'relative', flexShrink: 0,
          width: '100%', aspectRatio: '4/3', background: '#111',
          overflow: 'hidden'
        }}>
          {/* Flash effect */}
          {flash && (
            <div style={{
              position: 'absolute', inset: 0, background: 'white',
              opacity: 0.7, zIndex: 10, pointerEvents: 'none'
            }} />
          )}

          {/* Countdown overlay */}
          {countdown !== null && (
            <div
              onClick={cancelCountdown}
              style={{
                position: 'absolute', inset: 0, zIndex: 20,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.45)', cursor: 'pointer'
              }}
            >
              <span style={{
                fontSize: 96, fontWeight: 900, color: 'white',
                lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.6)',
                animation: 'countPop 0.35s ease'
              }}>
                {countdown}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 }}>
                Tap to cancel
              </span>
            </div>
          )}

          {cameraError ? (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24
            }}>
              <span style={{ fontSize: 48 }}>📷</span>
              <p style={{ color: '#aaa', fontSize: 14, textAlign: 'center', margin: 0 }}>{cameraError}</p>
              <button
                onClick={() => startCamera(facingMode)}
                style={{
                  padding: '8px 20px', background: 'linear-gradient(135deg,#FFB6C1,#DDA0DD)',
                  border: 'none', borderRadius: 20, color: 'white', fontWeight: 600, cursor: 'pointer'
                }}
              >Try again</button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
              }}
            />
          )}

          {/* Capture button + timer selector overlay */}
          {!cameraError && (
            <div style={{
              position: 'absolute', bottom: 12, left: 0, right: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
            }}>
              {/* Timer mode pills */}
              <div style={{ display: 'flex', gap: 6 }}>
                {TIMER_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setTimerMode(s)}
                    style={{
                      padding: '3px 10px', borderRadius: 12, border: 'none',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: timerMode === s ? 'white' : 'rgba(255,255,255,0.2)',
                      color: timerMode === s ? '#111' : 'white',
                      transition: 'all 0.15s'
                    }}
                  >
                    {s === 0 ? 'Off' : `${s}s`}
                  </button>
                ))}
              </div>

              {/* Shutter button */}
              <button
                onClick={handleShutterPress}
                disabled={!cameraReady || sending}
                style={{
                  width: 70, height: 70, borderRadius: '50%',
                  background: sending ? '#aaa' : countdown !== null ? 'rgba(255,80,80,0.85)' : 'white',
                  border: '4px solid rgba(255,255,255,0.5)',
                  cursor: cameraReady && !sending ? 'pointer' : 'default',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26
                }}
              >
                {sending ? '✓' : countdown !== null ? '⏹' : ''}
              </button>
            </div>
          )}
        </div>

        {/* Hint + file upload */}
        <div style={{ padding: '6px 16px 4px', flexShrink: 0 }}>
          <p style={{ color: '#888', fontSize: 12, textAlign: 'center', margin: '0 0 8px' }}>
            {timerMode > 0
              ? `${timerMode}s timer active — tap shutter to start`
              : 'Snap with camera or upload from your gallery'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <PhotoUpload
              isGoogleUser={isGoogleUser}
              onPhotoShared={() => {}}
            />
          </div>
        </div>

        {/* Friend photo grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 24px' }}>
          {loading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 3
            }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} style={{
                  aspectRatio: '1/1', borderRadius: 4,
                  background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s infinite',
                  animationDelay: `${i * 0.08}s`
                }} />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              minHeight: 120, gap: 8
            }}>
              <span style={{ fontSize: 36 }}>🌸</span>
              <p style={{ color: '#555', fontSize: 13, margin: 0, textAlign: 'center' }}>
                No photos yet — be the first to share one!
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 3
            }}>
              {photos.map(photo => {
                const isOwner = photo.uploadedBy._id === user?._id;
                const isHidden = photo.isHidden;
                const canToggle = isOwner && isGoogleUser;
                return (
                  <div
                    key={photo._id}
                    onClick={() => !isHidden || isOwner ? setSelectedPhoto(photo) : null}
                    style={{
                      position: 'relative', aspectRatio: '1/1',
                      overflow: 'hidden', cursor: (!isHidden || isOwner) ? 'pointer' : 'default',
                      borderRadius: 4, background: '#222'
                    }}
                  >
                    {isHidden && !isOwner ? (
                      <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, #1a1a2e, #2d1b69)',
                        gap: 4
                      }}>
                        <span style={{ fontSize: 20 }}>🔒</span>
                        <span style={{ color: '#aaa', fontSize: 9, textAlign: 'center', padding: '0 4px' }}>
                          Photo hidden by user
                        </span>
                      </div>
                    ) : (
                      <img
                        src={photo.dataUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isHidden ? 0.4 : 1 }}
                      />
                    )}

                    {/* Bottom overlay */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: '16px 4px 3px',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.6))'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <img
                            src={photo.uploadedBy.avatar}
                            alt=""
                            style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <span style={{ color: 'white', fontSize: 9, fontWeight: 600 }}>
                            {isOwner ? 'You' : photo.uploadedBy.name.split(' ')[0]}
                          </span>
                        </div>
                        {canToggle && (
                          <button
                            onClick={(e) => handleToggleVisibility(photo, e)}
                            disabled={togglingPhotoId === photo._id}
                            style={{
                              background: isHidden ? 'rgba(66,133,244,0.85)' : 'rgba(0,0,0,0.5)',
                              border: 'none', borderRadius: 8, padding: '2px 5px',
                              color: 'white', fontSize: 9, cursor: 'pointer', fontWeight: 700
                            }}
                          >
                            {isHidden ? '👁 Show' : '🔒'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Full-screen photo viewer */}
        {selectedPhoto && (
          <div
            onClick={() => setSelectedPhoto(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 200, padding: 20
            }}
          >
            {selectedPhoto.isHidden && selectedPhoto.uploadedBy._id !== user?._id ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 64 }}>🔒</div>
                <p style={{ color: '#aaa', fontSize: 16, marginTop: 12 }}>Photo hidden by user</p>
              </div>
            ) : (
              <img
                src={selectedPhoto.dataUrl}
                alt=""
                style={{
                  maxWidth: '100%', maxHeight: '70vh', borderRadius: 12, objectFit: 'contain',
                  opacity: selectedPhoto.isHidden ? 0.5 : 1
                }}
              />
            )}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src={selectedPhoto.uploadedBy.avatar}
                alt=""
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <p style={{ margin: 0, color: 'white', fontWeight: 600, fontSize: 14 }}>
                  {selectedPhoto.uploadedBy._id === user?._id ? 'You' : selectedPhoto.uploadedBy.name}
                </p>
                <p style={{ margin: 0, color: '#888', fontSize: 12 }}>
                  {new Date(selectedPhoto.createdAt).toLocaleTimeString()}
                </p>
              </div>
              {/* Hide/show toggle for Google-user owners */}
              {isGoogleUser && selectedPhoto.uploadedBy._id === user?._id && (
                <button
                  onClick={(e) => handleToggleVisibility(selectedPhoto, e)}
                  disabled={togglingPhotoId === selectedPhoto._id}
                  style={{
                    padding: '6px 14px', borderRadius: 16, border: 'none',
                    background: selectedPhoto.isHidden
                      ? 'linear-gradient(135deg, #4285F4, #34A853)'
                      : 'rgba(255,255,255,0.15)',
                    color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer'
                  }}
                >
                  {selectedPhoto.isHidden ? '👁 Show Photo' : '🔒 Hide Photo'}
                </button>
              )}
            </div>
            {isGoogleUser && selectedPhoto.uploadedBy._id === user?._id && (
              <p style={{ color: '#555', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                {selectedPhoto.isHidden
                  ? 'Other users see "Photo hidden by user"'
                  : 'Click 🔒 Hide Photo to restrict visibility to yourself only'}
              </p>
            )}
            <p style={{ color: '#666', fontSize: 12, marginTop: 10 }}>Tap anywhere to close</p>
          </div>
        )}

      </div>{/* end constrained column */}

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes countPop {
          0% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SharedPhotos;
