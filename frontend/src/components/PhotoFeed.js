import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLang } from '../i18n';

const PhotoFeed = ({ photos, friends, onUpload, loading }) => {
  const { user } = useAuth();
  const { t } = useLang();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sharedWith, setSharedWith] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      setPreview(evt.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !preview) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('sharedWith', JSON.stringify(sharedWith));

      await onUpload(formData);

      setShowUploadModal(false);
      setSelectedFile(null);
      setPreview(null);
      setSharedWith([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const toggleFriendShare = (friendId) => {
    setSharedWith(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  return (
    <div>
      <button
        className="btn btn-lavender"
        onClick={() => setShowUploadModal(true)}
        style={{ marginBottom: 20 }}
      >
        {t('mySpaceNewPhoto')}
      </button>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: '#888' }}>{t('loading')}</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ margin: 0, fontSize: '48px', marginBottom: '12px' }}>📸</p>
          <p style={{ margin: 0, color: '#888', fontWeight: 500 }}>{t('mySpaceNoPhotos')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {photos.map(photo => (
            <div
              key={photo._id}
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                aspectRatio: '1 / 1',
                background: '#F5F5F5',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <img
                src={photo.imageUrl}
                alt="Shared photo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.5)',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '12px'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}
              >
                <div style={{ fontSize: '12px', color: 'white', lineHeight: '1.4' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {photo.uploadedBy._id === user?._id ? t('you') : photo.uploadedBy.name}
                  </p>
                  <p style={{ margin: '2px 0 0', opacity: 0.8 }}>
                    {new Date(photo.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 500
          }}
          onClick={() => !uploading && setShowUploadModal(false)}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              borderRadius: 20,
              padding: 28,
              width: 'min(480px, 90vw)',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px', fontSize: 18, color: 'var(--text)' }}>
              📸 {t('mySpaceNewPhoto')}
            </h3>

            <form onSubmit={handleUpload}>
              {!preview ? (
                <div
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 12,
                    padding: '40px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    marginBottom: 20,
                    transition: 'background 0.2s'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => {
                    e.preventDefault();
                    e.currentTarget.style.background = 'rgba(128,100,180,0.05)';
                  }}
                  onDragLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.style.background = 'transparent';
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const event = { target: { files: [file] } };
                      handleFileSelect(event);
                    }
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: '32px' }}>🖼️</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    Click to upload or drag & drop
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--subtext)' }}>
                    PNG, JPG, GIF up to 5MB
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      width: '100%',
                      maxHeight: '240px',
                      borderRadius: 12,
                      overflow: 'hidden',
                      marginBottom: 12,
                      background: '#F5F5F5'
                    }}
                  >
                    <img
                      src={preview}
                      alt="Preview"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setPreview(null);
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    style={{ width: '100%', marginBottom: 20 }}
                  >
                    Change photo
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {friends.length > 0 && (
                <>
                  <label style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--subtext)',
                    display: 'block',
                    marginBottom: 10
                  }}>
                    Share with close friends
                  </label>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                    {friends.map(f => (
                      <label
                        key={f.friendId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 12px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          background: sharedWith.includes(f.friendId) ? 'rgba(255,182,193,0.1)' : 'var(--search-bg)',
                          border: sharedWith.includes(f.friendId) ? '1.5px solid #FFB6C1' : '1.5px solid var(--border)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={sharedWith.includes(f.friendId)}
                          onChange={() => toggleFriendShare(f.friendId)}
                          style={{ accentColor: '#FFB6C1' }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {f.customNickname}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  className="btn"
                  style={{ flex: 1 }}
                  disabled={!preview || uploading}
                >
                  {uploading ? '⏳ Uploading...' : '📤 Share'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowUploadModal(false);
                    setPreview(null);
                    setSelectedFile(null);
                    setSharedWith([]);
                  }}
                  disabled={uploading}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoFeed;
