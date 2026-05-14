import React, { useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

const PhotoUpload = ({ isGoogleUser, onPhotoShared }) => {
  const { socket } = useSocket();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleShare = () => {
    if (!preview || !socket || uploading) return;
    const sizeBytes = Math.round((preview.length * 3) / 4);
    if (sizeBytes > 5 * 1024 * 1024) {
      alert('Photo is too large (max 5 MB). Please choose a smaller image.');
      return;
    }
    setUploading(true);
    socket.emit('share_photo', { dataUrl: preview, caption });
    setTimeout(() => {
      setUploading(false);
      setPreview(null);
      setCaption('');
      if (onPhotoShared) onPhotoShared();
    }, 800);
  };

  const handleCancel = () => {
    setPreview(null);
    setCaption('');
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        ref={fileRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {!preview ? (
        <button
          onClick={() => fileRef.current.click()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 20, border: 'none',
            background: isGoogleUser
              ? 'linear-gradient(135deg, #4285F4, #34A853)'
              : 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
            color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer'
          }}
        >
          📁 {isGoogleUser ? 'Share Photo (Premium)' : 'Share Photo'}
        </button>
      ) : (
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 16, padding: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          maxWidth: 320
        }}>
          <img
            src={preview}
            alt="preview"
            style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 200 }}
          />

          <input
            type="text"
            placeholder="Add a caption..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            maxLength={200}
            style={{
              width: '100%', marginTop: 10, padding: '8px 12px',
              borderRadius: 10, border: '1.5px solid #E8D5F0',
              fontSize: 13, boxSizing: 'border-box'
            }}
          />

          {isGoogleUser && (
            <div style={{
              marginTop: 10, padding: '8px 12px',
              background: 'linear-gradient(135deg, #E8F4FD, #EDE7FF)',
              borderRadius: 10, fontSize: 12, color: '#4A4A8A',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              🔐 <strong>Google Premium:</strong> After sharing, you can hide/show this photo from the photo grid.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={handleCancel}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10, border: '1.5px solid #E8D5F0',
                background: 'white', fontSize: 13, cursor: 'pointer', color: '#888'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleShare}
              disabled={uploading}
              style={{
                flex: 2, padding: '8px 0', borderRadius: 10, border: 'none',
                background: uploading ? '#ccc' : 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
                color: 'white', fontWeight: 700, fontSize: 13,
                cursor: uploading ? 'default' : 'pointer'
              }}
            >
              {uploading ? '✓ Shared!' : '📤 Share'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
