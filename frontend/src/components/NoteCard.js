import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import ImageAnnotationCanvas from './ImageAnnotationCanvas';

const compressImage = (file, maxWidth = 800, quality = 0.72) =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = url;
  });

const fmtRelative = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const NoteCard = ({ note, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [images, setImages] = useState(note.images || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [annotatingIdx, setAnnotatingIdx] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const saveTimer = useRef(null);
  const fileInputRef = useRef(null);

  // Sync if parent updates this note externally (intentionally keyed on _id only)
  const noteId = note._id;
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setImages(note.images || []);
  }, [noteId]); // eslint-disable-line

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const doSave = useCallback(async (t, c, imgs) => {
    setSaving(true);
    try {
      const { data } = await api.put(`/private-space/notes/${note._id}`, {
        title: t,
        content: c,
        images: imgs,
      });
      onUpdate(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [note._id, onUpdate]);

  const schedSave = useCallback((t, c, imgs) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(t, c, imgs), 900);
  }, [doSave]);

  const handleImageUpload = async (files) => {
    const added = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const dataUrl = await compressImage(file);
        added.push({ id: `${Date.now()}-${Math.random()}`, dataUrl });
      } catch (e) {
        console.error('Image compress failed:', e);
      }
    }
    if (!added.length) return;
    const next = [...images, ...added];
    setImages(next);
    schedSave(title, content, next);
  };

  const removeImage = (idx) => {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    schedSave(title, content, next);
  };

  const saveAnnotation = (idx, dataUrl) => {
    const next = images.map((img, i) => (i === idx ? { ...img, dataUrl } : img));
    setImages(next);
    setAnnotatingIdx(null);
    schedSave(title, content, next);
  };

  const previewText = content.replace(/\s+/g, ' ').trim().slice(0, 180);

  return (
    <>
      <div
        onDragOver={(e) => { if (expanded) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!expanded) return;
          e.preventDefault();
          setDragOver(false);
          handleImageUpload(Array.from(e.dataTransfer.files));
        }}
        style={{
          background: dragOver
            ? 'linear-gradient(160deg, #251f3e 0%, #2e2550 100%)'
            : 'linear-gradient(160deg, #1e1a35 0%, #251f3e 100%)',
          border: dragOver
            ? '1.5px dashed rgba(221,160,221,0.6)'
            : expanded
              ? '1.5px solid rgba(221,160,221,0.35)'
              : '1px solid rgba(221,160,221,0.18)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: expanded
            ? '0 12px 40px rgba(0,0,0,0.5)'
            : '0 4px 16px rgba(0,0,0,0.3)',
          transition: 'box-shadow 0.3s, border-color 0.3s',
        }}
      >
        {/* ── Clickable header ── */}
        <div
          onClick={() => setExpanded((v) => !v)}
          style={{ padding: '16px 18px', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {expanded ? (
                <input
                  value={title}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { setTitle(e.target.value); schedSave(e.target.value, content, images); }}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1.5px solid rgba(221,160,221,0.3)',
                    color: '#f5eeff',
                    fontSize: 16,
                    fontWeight: 700,
                    padding: '2px 0 6px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    marginBottom: 2,
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <h4 style={{
                  margin: '0 0 5px',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#f5eeff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>{title}</h4>
              )}

              {!expanded && (
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  color: '#9b87bb',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.45,
                }}>
                  {previewText || <em style={{ opacity: 0.45 }}>No content</em>}
                </p>
              )}
            </div>

            {/* Right side controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {saving && <span style={{ fontSize: 11, color: '#9b87bb' }}>saving…</span>}
              {saved && !saving && <span style={{ fontSize: 11, color: '#7bd389' }}>✓ saved</span>}
              {images.length > 0 && !expanded && (
                <span style={{
                  fontSize: 11, color: '#c4a3dc',
                  background: 'rgba(221,160,221,0.15)',
                  padding: '2px 7px', borderRadius: 20,
                }}>📷 {images.length}</span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(note._id); }}
                style={{
                  background: 'rgba(255,100,100,0.1)',
                  border: '1px solid rgba(255,100,100,0.2)',
                  borderRadius: 8, color: '#ff8888',
                  padding: '3px 8px', fontSize: 12, cursor: 'pointer',
                }}
              >✕</button>
              <span style={{
                fontSize: 14, color: '#9b87bb',
                display: 'inline-block',
                transform: expanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
              }}>▾</span>
            </div>
          </div>

          {/* Timestamp */}
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: '#6b5a8a' }}>
            <span>{fmtRelative(note.updatedAt || note.createdAt)}</span>
            {note.sharedWith?.length > 0 && (
              <span>👥 {note.sharedWith.length}</span>
            )}
          </div>
        </div>

        {/* ── Expandable body ── */}
        <div style={{
          maxHeight: expanded ? 2400 : 0,
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease',
        }}>
          <div style={{ padding: '4px 18px 20px', borderTop: '1px solid rgba(221,160,221,0.1)' }}>
            {/* Content textarea */}
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); schedSave(title, e.target.value, images); }}
              placeholder="Write your thoughts…"
              style={{
                width: '100%',
                minHeight: 110,
                resize: 'vertical',
                background: 'rgba(255,255,255,0.04)',
                border: '1.5px solid rgba(221,160,221,0.15)',
                borderRadius: 12,
                color: '#e8dcff',
                padding: '12px 14px',
                fontSize: 14,
                lineHeight: 1.65,
                outline: 'none',
                fontFamily: 'inherit',
                marginTop: 14,
                boxSizing: 'border-box',
                whiteSpace: 'pre-wrap',
              }}
            />

            {/* Image gallery */}
            {images.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 8,
                marginTop: 12,
              }}>
                {images.map((img, idx) => (
                  <div key={img.id || idx} style={{
                    position: 'relative',
                    borderRadius: 10,
                    overflow: 'hidden',
                    aspectRatio: '4 / 3',
                    background: '#111',
                  }}>
                    <img
                      src={img.dataUrl}
                      alt=""
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {/* Gradient overlay */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.55))',
                      pointerEvents: 'none',
                    }} />
                    {/* Annotate button */}
                    <button
                      onClick={() => setAnnotatingIdx(idx)}
                      title="Draw / annotate"
                      style={{
                        position: 'absolute', bottom: 5, left: 5,
                        background: 'rgba(0,0,0,0.65)', border: 'none',
                        borderRadius: 6, color: 'white',
                        padding: '3px 7px', fontSize: 12, cursor: 'pointer',
                      }}
                    >✏️</button>
                    {/* Remove button */}
                    <button
                      onClick={() => removeImage(idx)}
                      title="Remove image"
                      style={{
                        position: 'absolute', top: 5, right: 5,
                        background: 'rgba(0,0,0,0.65)', border: 'none',
                        borderRadius: 6, color: 'white',
                        padding: '3px 7px', fontSize: 11, cursor: 'pointer',
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload area / drop hint */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px',
                  background: 'rgba(221,160,221,0.1)',
                  border: '1.5px dashed rgba(221,160,221,0.3)',
                  borderRadius: 10, color: '#c4a3dc',
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.2s',
                }}
              >
                📷 Add image
              </button>
              <span style={{ fontSize: 11, color: '#5a4a7a' }}>
                or drag &amp; drop here
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { handleImageUpload(e.target.files); e.target.value = ''; }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Annotation modal */}
      {annotatingIdx !== null && images[annotatingIdx] && (
        <ImageAnnotationCanvas
          imageUrl={images[annotatingIdx].dataUrl}
          onSave={(url) => saveAnnotation(annotatingIdx, url)}
          onClose={() => setAnnotatingIdx(null)}
        />
      )}
    </>
  );
};

export default NoteCard;
