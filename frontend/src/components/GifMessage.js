import React, { useEffect, useMemo, useState } from 'react';

export const getGifAspectRatio = (width, height) => {
  const w = Number(width); const h = Number(height);
  return w > 0 && h > 0 ? `${Math.min(Math.max(w / h, 0.5), 2.5)}` : '16 / 9';
};

const GifMessage = ({ url, preview, previewUrl, width, height, title = 'GIF' }) => {
  const previewSource = previewUrl || preview || url;
  const [primaryLoaded, setPrimaryLoaded] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const aspectRatio = useMemo(() => getGifAspectRatio(width, height), [width, height]);

  useEffect(() => { setPrimaryLoaded(false); setPreviewLoaded(false); setPrimaryFailed(false); setPreviewFailed(false); }, [url, previewSource, retryKey]);
  useEffect(() => {
    if (!url || primaryLoaded || primaryFailed) return undefined;
    const timer = setTimeout(() => setPrimaryFailed(true), 10000);
    return () => clearTimeout(timer);
  }, [url, primaryLoaded, primaryFailed, retryKey]);
  if (!url) return null;

  const showPreview = previewSource && !previewFailed && (!primaryLoaded || primaryFailed || previewSource === url);
  const unavailable = primaryFailed && (!previewSource || previewFailed);
  return <div className="gif-message" style={{ aspectRatio }}>
    {!unavailable && showPreview && <img className="gif-message-preview" src={previewSource} alt="" aria-hidden="true" onLoad={() => setPreviewLoaded(true)} onError={() => setPreviewFailed(true)} />}
    {!unavailable && <img className="gif-message-primary" src={url} alt={title} title={title} width={width || undefined} height={height || undefined} onLoad={() => setPrimaryLoaded(true)} onError={() => setPrimaryFailed(true)} style={{ opacity: primaryLoaded ? 1 : 0 }} />}
    {!unavailable && !primaryLoaded && !previewLoaded && <div className="gif-message-loading" role="status">Loading GIF…</div>}
    {unavailable && <div className="gif-message-error" role="alert"><span>GIF unavailable</span><button type="button" onClick={() => setRetryKey(value => value + 1)}>Retry</button></div>}
  </div>;
};
export default GifMessage;
