import React, { useState } from 'react';

const StickerDisplay = ({ emoji, imageUrl, label, size = 'medium' }) => {
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(!!imageUrl);

  const sizeMap = {
    small: { width: 48, height: 48, fontSize: 24 },
    medium: { width: 72, height: 72, fontSize: 36 },
    large: { width: 96, height: 96, fontSize: 48 },
  };

  const style = sizeMap[size] || sizeMap.medium;

  // If we have an imageUrl and it hasn't failed, try to display it
  if (imageUrl && !imageError) {
    return (
      <div
        style={{
          width: style.width,
          height: style.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          borderRadius: 8,
          backgroundColor: '#f5f5f5',
          overflow: 'hidden',
        }}
        title={label}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#e0e0e0',
              fontSize: 12,
              color: '#999',
            }}
          >
            ⏳
          </div>
        )}

        <img
          src={imageUrl}
          alt={label}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setImageError(true);
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 4,
            display: loading ? 'none' : 'block',
          }}
        />
      </div>
    );
  }

  // Fallback to emoji if no imageUrl or image failed
  return (
    <div
      style={{
        width: style.width,
        height: style.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: style.fontSize,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
        cursor: 'default',
      }}
      title={label}
    >
      {emoji}
    </div>
  );
};

export default StickerDisplay;
