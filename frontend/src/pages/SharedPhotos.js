import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const SharedPhotos = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('user');
  const [photos, setPhotos] = useState([]);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

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
    } catch (err) {
      setCameraError('Camera not available. Allow camera access and try again.');
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, startCamera]);

  // Real-time incoming photos via Socket.io
  useEffect(() => {
    if (!socket || !user) return;
    const event = `new_photo_shared:${user._id}`;
    const handler = (photo) => {
      setPhotos(prev => [photo, ...prev].slice(0, 50));
    };
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket, user]);

  const captureAndShare = () => {
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
  };

  const flipCamera = () => {
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
        <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>📸 Shared Photos</span>
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
            opacity: 0.7, zIndex: 10, pointerEvents: 'none',
            transition: 'opacity 0.25s'
          }} />
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

        {/* Capture button overlay */}
        {!cameraError && (
          <div style={{
            position: 'absolute', bottom: 16, left: 0, right: 0,
            display: 'flex', justifyContent: 'center'
          }}>
            <button
              onClick={captureAndShare}
              disabled={!cameraReady || sending}
              style={{
                width: 70, height: 70, borderRadius: '50%',
                background: sending ? '#aaa' : 'white',
                border: '4px solid rgba(255,255,255,0.5)',
                cursor: cameraReady && !sending ? 'pointer' : 'default',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28
              }}
            >
              {sending ? '✓' : ''}
            </button>
          </div>
        )}
      </div>

      {/* Hint */}
      <p style={{
        color: '#888', fontSize: 12, textAlign: 'center',
        margin: '8px 0 6px', flexShrink: 0
      }}>
        Tap the button to snap & share with all your friends
      </p>

      {/* Friend photo grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 24px' }}>
        {photos.length === 0 ? (
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
            {photos.map(photo => (
              <div
                key={photo._id}
                onClick={() => setSelectedPhoto(photo)}
                style={{
                  position: 'relative', aspectRatio: '1/1',
                  overflow: 'hidden', cursor: 'pointer', borderRadius: 4,
                  background: '#222'
                }}
              >
                <img
                  src={photo.dataUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '16px 4px 3px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.55))'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <img
                      src={photo.uploadedBy.avatar}
                      alt=""
                      style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span style={{ color: 'white', fontSize: 10, fontWeight: 600 }}>
                      {photo.uploadedBy._id === user?._id ? 'You' : photo.uploadedBy.name.split(' ')[0]}
                    </span>
                  </div>
                </div>
              </div>
            ))}
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
          <img
            src={selectedPhoto.dataUrl}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 12, objectFit: 'contain' }}
          />
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
          </div>
          <p style={{ color: '#666', fontSize: 12, marginTop: 16 }}>Tap anywhere to close</p>
        </div>
      )}

      </div>{/* end constrained column */}
    </div>
  );
};

export default SharedPhotos;
