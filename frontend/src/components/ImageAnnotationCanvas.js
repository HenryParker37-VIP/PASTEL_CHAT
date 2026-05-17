import React, { useCallback, useEffect, useRef, useState } from 'react';

const PALETTE = ['#FF3366', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3', '#CE93D8', '#ffffff', '#000000'];

const ImageAnnotationCanvas = ({ imageUrl, onSave, onClose }) => {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const lastPosRef = useRef(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef([]);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(PALETTE[0]);
  const [brushSize, setBrushSize] = useState(4);

  // Load image, size canvas to match natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      // Push empty initial state for undo
      historyRef.current = [canvas.toDataURL()];
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const getPos = useCallback((e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const src = e.touches?.[0] || e.changedTouches?.[0] || e;
    return {
      x: (src.clientX - rect.left) * sx,
      y: (src.clientY - rect.top) * sy,
    };
  }, []);

  const applyStyle = useCallback((ctx, activeTool, activeColor, size) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = size * 5;
    } else if (activeTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      const r = parseInt(activeColor.slice(1, 3), 16);
      const g = parseInt(activeColor.slice(3, 5), 16);
      const b = parseInt(activeColor.slice(5, 7), 16);
      ctx.strokeStyle = `rgba(${r},${g},${b},0.38)`;
      ctx.lineWidth = size * 6;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = size;
    }
  }, []);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawingRef.current = true;
    const pos = getPos(e, canvas);
    lastPosRef.current = pos;
    // Paint a dot at the start point
    const ctx = canvas.getContext('2d');
    applyStyle(ctx, tool, color, brushSize);
    ctx.beginPath();
    const r = tool === 'eraser' ? brushSize * 2.5 : brushSize / 2;
    ctx.arc(pos.x, pos.y, Math.max(r, 1), 0, Math.PI * 2);
    ctx.fill();
  }, [tool, color, brushSize, getPos, applyStyle]);

  const onPointerMove = useCallback((e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    applyStyle(ctx, tool, color, brushSize);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  }, [tool, color, brushSize, getPos, applyStyle]);

  const onPointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snap = canvas.toDataURL();
    historyRef.current.push(snap);
    if (historyRef.current.length > 40) historyRef.current.shift();
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = prev;
  }, []);

  const handleSave = useCallback(() => {
    const orig = imgRef.current;
    if (!orig) return;
    const out = document.createElement('canvas');
    out.width = orig.naturalWidth;
    out.height = orig.naturalHeight;
    const ctx = out.getContext('2d');
    ctx.drawImage(orig, 0, 0);
    // Draw annotation layer (canvas already at natural resolution)
    ctx.drawImage(canvasRef.current, 0, 0);
    onSave(out.toDataURL('image/jpeg', 0.85));
  }, [onSave]);

  const TOOL_CURSOR = tool === 'eraser' ? 'cell' : 'crosshair';

  return (
    <div
      className="backdrop-in"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5,3,15,0.93)',
        backdropFilter: 'blur(6px)',
        zIndex: 800,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 14px',
        background: 'rgba(30,26,53,0.97)',
        borderBottom: '1px solid rgba(221,160,221,0.15)',
        flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#9b87bb',
          fontSize: 20, cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
        }}>✕</button>

        <div style={{ width: 1, height: 24, background: 'rgba(221,160,221,0.2)', margin: '0 4px' }} />

        {/* Tools */}
        {[
          { id: 'pen', label: '✏️', title: 'Pen' },
          { id: 'highlighter', label: '🖊', title: 'Highlighter' },
          { id: 'eraser', label: '⌫', title: 'Eraser' },
        ].map(({ id, label, title: ttl }) => (
          <button
            key={id}
            title={ttl}
            onClick={() => setTool(id)}
            style={{
              padding: '6px 11px',
              borderRadius: 8,
              border: tool === id ? '2px solid #DDA0DD' : '2px solid transparent',
              background: tool === id ? 'rgba(221,160,221,0.22)' : 'rgba(255,255,255,0.06)',
              color: '#e8dcff', fontSize: 16, cursor: 'pointer',
              transition: 'all 0.18s',
            }}
          >{label}</button>
        ))}

        {/* Undo */}
        <button onClick={undo} style={{
          padding: '6px 11px', borderRadius: 8,
          border: '2px solid transparent',
          background: 'rgba(255,255,255,0.06)',
          color: '#e8dcff', fontSize: 13, cursor: 'pointer',
        }}>↩ Undo</button>

        <div style={{ width: 1, height: 24, background: 'rgba(221,160,221,0.2)', margin: '0 4px' }} />

        {/* Color palette */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }}
              style={{
                width: 22, height: 22,
                borderRadius: '50%',
                background: c,
                border: color === c ? '2.5px solid white' : '2px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', flexShrink: 0,
                boxShadow: color === c ? `0 0 0 2px ${c}60` : 'none',
                transition: 'transform 0.15s',
                transform: color === c ? 'scale(1.18)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Brush size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#6b5a8a' }}>Size</span>
          <input
            type="range" min={2} max={28} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ width: 64, accentColor: '#DDA0DD' }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Save */}
        <button
          onClick={handleSave}
          style={{
            padding: '8px 20px',
            background: 'linear-gradient(135deg, #FFB6C1, #DDA0DD)',
            border: 'none', borderRadius: 10,
            color: 'white', fontWeight: 700,
            fontSize: 13, cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(221,160,221,0.4)',
          }}
        >
          💾 Save
        </button>
      </div>

      {/* ── Canvas area ── */}
      <div style={{
        flex: 1, overflow: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
        <div style={{ position: 'relative', maxWidth: '100%', lineHeight: 0 }}>
          {/* Original image (display layer) */}
          <img
            src={imageUrl}
            alt="annotate"
            draggable={false}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 'calc(100dvh - 120px)',
              userSelect: 'none',
              borderRadius: 8,
            }}
          />
          {/* Transparent annotation canvas overlaid */}
          <canvas
            ref={canvasRef}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              cursor: TOOL_CURSOR,
              touchAction: 'none',
              borderRadius: 8,
            }}
          />
        </div>
      </div>

      {/* Hint */}
      <p style={{
        textAlign: 'center',
        margin: '0 0 10px',
        fontSize: 12,
        color: '#5a4a7a',
        flexShrink: 0,
      }}>
        Draw on the image · Tap ✏️ Annotate button on any note image to edit
      </p>
    </div>
  );
};

export default ImageAnnotationCanvas;
