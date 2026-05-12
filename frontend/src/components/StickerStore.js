import React, { useState, useEffect, useCallback } from 'react';
import { stickerApi } from '../services/api';

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
              {s.emoji}
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

      {/* Pack list */}
      {loading ? (
        <div className="store-loading">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="store-skeleton" />
          ))}
        </div>
      ) : (
        <div className="store-pack-list">
          {packs.map(pack => (
            <div key={pack.id} className="store-pack-row" onClick={() => openDetail(pack)}>
              <div className="store-pack-cover">{pack.cover}</div>
              <div className="store-pack-meta">
                <div className="store-pack-name">{pack.nameVi || pack.name}</div>
                <div className="store-pack-tags">
                  {pack.tags?.slice(0, 2).map(t => (
                    <span key={t} className="store-tag">#{t}</span>
                  ))}
                </div>
              </div>
              <button
                className={`store-add-btn ${pack.isAdded ? 'added' : ''}`}
                disabled={busy === pack.id}
                onClick={e => { e.stopPropagation(); togglePack(pack); }}
              >
                {busy === pack.id ? '…' : pack.isAdded ? '✓' : '+'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StickerStore;
