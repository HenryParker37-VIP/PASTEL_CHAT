import React, { useState } from 'react';

const GifMessage = ({ url, preview, title = 'GIF' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!url) return null;

  const handleLoad = () => setLoading(false);
  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
        maxWidth: '100%',
        aspectRatio: '16 / 9',
      }}
    >
      {loading && (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#e0e0e0',
            color: '#999',
            fontSize: 12,
          }}
        >
          Loading GIF...
        </div>
      )}

      {error ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            color: '#999',
            fontSize: 12,
            textAlign: 'center',
            padding: 8,
          }}
        >
          Failed to load GIF
        </div>
      ) : (
        <>
          {/* Use img for direct GIF rendering (supports animation natively) */}
          <img
            src={url}
            alt={title}
            title={title}
            loading="lazy"
            onLoad={handleLoad}
            onError={handleError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: loading ? 'none' : 'block',
            }}
          />

          {/* Fallback video element for better mobile support (if URL is a .gif file) */}
          {url.toLowerCase().endsWith('.gif') && (
            <video
              autoPlay
              loop
              muted
              playsInline
              onLoadedMetadata={handleLoad}
              onError={handleError}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: loading ? 'none' : 'block',
              }}
            >
              <source src={url} type="video/mp4" />
              GIF not supported
            </video>
          )}
        </>
      )}
    </div>
  );
};

export default GifMessage;
