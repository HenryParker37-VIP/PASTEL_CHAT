import React, { useState, useEffect, useCallback } from 'react';
import { stickerApi } from '../services/api';
import StickerDisplay from './StickerDisplay';

const StickerStore = ({ onClose, onPacksChanged }) => {
  const [packs, setPacks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // packId being toggled

  const loadPacks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await stickerApi.getAllPacks();
      setPacks(data.packs);
    } catch (e) {
      console.error('[StickerStore]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPacks(); }, [loadPacks]);

  const togglePack = async (pack) => {
    setBusy(pack.id);
    try {
      if (pack.isAdded) {
        await stickerApi.removePack(pack.slug);
      } else {
        await stickerApi.addPack(pack.slug);
      }
      setPacks(prev => prev.map(p =>
        p.id === pack.id ? { ...p, isAdded: !p.isAdded } : p
      ));
      if (selected?.id === pack.id) {
        setSelected(prev => ({ ...prev, isAdded: !prev.isAdded }));
      }
      onPacksChanged?.();
    } catch (e) {
      console.error('[StickerStore] toggle error', e);
    } finally {
      setBusy(null);
    }
  };

  const openDetail = async (pack) => {
    try {
      const { data } = await stickerApi.getPack(pack.slug);
      setSelected(data);
    } catch {
      setSelected(pack);
    }
  };

  if (selected) {
    return (
      <div className="sticker-store" onClick={e => e.stopPropagation()}>
        {/* Detail header */}
        <div className="sticker-store-header">
          <button className="store-back-btn" onClick={() => setSelected(null)}>←</button>
          <span className="store-title">{selected.nameVi || selected.name}</span>
          <button className="gif-close" onClick={onClose}>✕</button>
        </div>

        {/* Pack info */}
        <div className="store-pack-info">
          <div className="store-pack-cover-lg">{selected.cover}</div>
          <div>
            <div className="store-pack-name">{selected.nameVi || selected.name}</div>
            <div className="store-pack-desc">{selected.description}</div>
            <div className="store-pack-count">{selected.stickers?.length || 0} stickers</div>
          </div>
        </div>

        {/* Preview grid */}
        <div className="store-preview-grid">
          {(selected.stickers || []).map((s, i) => (
            <div key={i} className="store-preview-item" title={s.labelVi || s.label}>
              <StickerDisplay
                emoji={s.emoji}
                imageUrl={s.imageUrl}
                label={s.labelVi || s.label}
                size="medium"
              />
            </div>
          ))}
        </div>

        {/* Add / Remove button */}
        <div className="store-detail-footer">
          <button
            className={`btn ${selected.isAdded ? 'btn-ghost' : 'btn-blue'}`}
            style={{ width: '100%', padding: '12px' }}
            disabled={busy === selected.id}
            onClick={() => togglePack(selected)}
          >
            {busy === selected.id
              ? '...'
              : selected.isAdded
                ? '✓ Added to your stickers'
                : '+ Add to my stickers'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sticker-store" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="sticker-store-header">
        <span className="store-title">🛍️ Sticker Store</span>
        <button className="gif-close" onClick={onClose}>✕</button>
      </div>

      <div className="store-subtitle">Tap a pack to preview · {packs.filter(p => p.isAdded).length} added</div>

      {/* Pack grid */}
      {loading ? (
        <div className="store-pack-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="store-pack-card-skeleton" />
          ))}
        </div>
      ) : (
        <div className="store-pack-grid">
          {packs.map(pack => (
            <div
              key={pack.id}
              className="store-pack-card"
              onClick={() => openDetail(pack)}
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #ddd',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Cover */}
              <div
                style={{
                  height: 120,
                  backgroundColor: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                  borderBottom: '1px solid #e0e0e0'
                }}
              >
                {pack.cover}
              </div>

              {/* Meta */}
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 4 }}>
                  {pack.nameVi || pack.name}
                </div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                  {pack.stickerCount || 20} stickers
                </div>
                <button
                  className={`btn ${pack.isAdded ? 'btn-ghost' : 'btn-blue'}`}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: 12,
                    borderRadius: 6,
                  }}
                  disabled={busy === pack.id}
                  onClick={e => {
                    e.stopPropagation();
                    togglePack(pack);
                  }}
                >
                  {busy === pack.id ? '…' : pack.isAdded ? '✓ Added' : '+ Add'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StickerStore;
