import React, { useState, useEffect, useRef, useCallback } from 'react';
import { stickerApi } from '../services/api';
import StickerStore from './StickerStore';

// Giphy public beta key — works for non-commercial / dev use
const GIPHY_KEY = process.env.REACT_APP_GIPHY_API_KEY || 'dc6zaTOxFJmzC';
const GIPHY_BASE = 'https://api.giphy.com/v1';
const LIMIT = 21;

async function fetchGiphy(endpoint, params = {}) {
  const url = new URL(`${GIPHY_BASE}${endpoint}`);
  url.searchParams.set('api_key', GIPHY_KEY);
  url.searchParams.set('limit', LIMIT);
  url.searchParams.set('rating', 'g');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Giphy error');
  return (await res.json()).data;
}

const gifUrl = (item) =>
  item?.images?.fixed_height?.url || item?.images?.original?.url || '';
const gifPreview = (item) =>
  item?.images?.fixed_height_small?.url || item?.images?.fixed_height?.url || '';

// ─────────────────────────────────────────────────────────────────────────────

const GifStickerPicker = ({ onSelect, onClose }) => {
  const [tab, setTab] = useState('stickers'); // 'stickers' | 'gifs' | 'store'
  const [search, setSearch] = useState('');

  // Sticker state
  const [myPacks, setMyPacks] = useState([]);
  const [activePack, setActivePack] = useState(null);
  const [packsLoading, setPacksLoading] = useState(true);

  // GIF state
  const [gifs, setGifs] = useState([]);
  const [gifsLoading, setGifsLoading] = useState(false);

  const debounceRef = useRef(null);
  const searchRef = useRef(null);

  // ── Load user's sticker packs ─────────────────────────────────────────────
  const loadMyPacks = useCallback(async () => {
    setPacksLoading(true);
    try {
      const { data } = await stickerApi.getMyPacks();
      setMyPacks(data.packs || []);
      if (data.packs?.length > 0 && !activePack) {
        setActivePack(data.packs[0].id);
      }
    } catch (e) {
      console.error('[Picker] loadMyPacks', e);
    } finally {
      setPacksLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { loadMyPacks(); }, [loadMyPacks]);

  // ── Load GIFs ─────────────────────────────────────────────────────────────
  const loadGifs = useCallback(async (query) => {
    setGifsLoading(true);
    try {
      const endpoint = query ? '/gifs/search' : '/gifs/trending';
      const params = query ? { q: query } : {};
      const data = await fetchGiphy(endpoint, params);
      setGifs(data);
    } catch (e) {
      console.error('[Picker] loadGifs', e);
      setGifs([]);
    } finally {
      setGifsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'gifs') loadGifs('');
  }, [tab, loadGifs]);

  useEffect(() => {
    if (tab !== 'gifs') return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadGifs(search), 450);
    return () => clearTimeout(debounceRef.current);
  }, [search, tab, loadGifs]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const sendSticker = (emoji, labelVi) => {
    onSelect({ type: 'sticker', emoji, label: labelVi || emoji });
    onClose();
  };

  const sendGif = (item) => {
    onSelect({ type: 'gif', url: gifUrl(item), preview: gifPreview(item), title: item.title || 'GIF' });
    onClose();
  };

  // Current pack stickers (optionally filtered by search)
  const currentPack = myPacks.find(p => p.id === activePack) || myPacks[0];
  const visibleStickers = currentPack
    ? (search.trim()
        ? myPacks.flatMap(p => p.stickers || []).filter(s =>
            s.labelVi?.toLowerCase().includes(search.toLowerCase()) ||
            s.label?.toLowerCase().includes(search.toLowerCase())
          ).slice(0, 40)
        : currentPack.stickers || [])
    : [];

  if (tab === 'store') {
    return (
      <div className="gif-picker" onClick={e => e.stopPropagation()}>
        <StickerStore
          onClose={onClose}
          onPacksChanged={() => {
            loadMyPacks();
            setTab('stickers');
          }}
        />
      </div>
    );
  }

  return (
    <div className="gif-picker" onClick={e => e.stopPropagation()}>
      {/* ── Tab bar ── */}
      <div className="gif-picker-header">
        <div className="gif-tabs">
          <button
            className={`gif-tab ${tab === 'stickers' ? 'active' : ''}`}
            onClick={() => { setTab('stickers'); setSearch(''); }}
          >🩷 Stickers</button>
          <button
            className={`gif-tab ${tab === 'gifs' ? 'active' : ''}`}
            onClick={() => { setTab('gifs'); setSearch(''); }}
          >🎞️ GIFs</button>
          <button
            className={`gif-tab ${tab === 'store' ? 'active' : ''}`}
            onClick={() => setTab('store')}
          >🛍️ Store</button>
        </div>
        <button className="gif-close" onClick={onClose}>✕</button>
      </div>

      {/* ── Search bar ── */}
      <div className="gif-search-wrap">
        <span className="gif-search-icon">🔍</span>
        <input
          ref={searchRef}
          className="gif-search-input"
          placeholder={tab === 'stickers' ? 'Search stickers…' : 'Search GIFs…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="gif-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* ── STICKERS tab ── */}
      {tab === 'stickers' && (
        <>
          {/* Pack tabs */}
          {!search && myPacks.length > 0 && (
            <div className="sticker-pack-tabs">
              {myPacks.map(pack => (
                <button
                  key={pack.id}
                  className={`sticker-pack-tab ${activePack === pack.id ? 'active' : ''}`}
                  onClick={() => setActivePack(pack.id)}
                  title={pack.nameVi || pack.name}
                >
                  {pack.cover}
                </button>
              ))}
              {/* Store shortcut */}
              <button
                className="sticker-pack-tab sticker-store-shortcut"
                onClick={() => setTab('store')}
                title="Get more sticker packs"
              >＋</button>
            </div>
          )}

          <div className="gif-scroll">
            {packsLoading ? (
              <div className="gif-loading">
                {[...Array(12)].map((_, i) => <div key={i} className="gif-skeleton" style={{ borderRadius: 12, height: 52 }} />)}
              </div>
            ) : myPacks.length === 0 ? (
              <div className="gif-empty" style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 40 }}>🛍️</div>
                <p style={{ margin: '8px 0 4px', fontWeight: 700 }}>No sticker packs yet!</p>
                <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 16px' }}>Visit the store to add packs</p>
                <button className="btn btn-blue" onClick={() => setTab('store')}>
                  Open Sticker Store
                </button>
              </div>
            ) : (
              <div className="gif-grid sticker-emoji-grid">
                {visibleStickers.map((s, i) => (
                  <button
                    key={`${s.id || i}`}
                    className="sticker-emoji-btn"
                    onClick={() => sendSticker(s.emoji, s.labelVi)}
                    title={s.labelVi || s.label}
                  >
                    {s.emoji}
                  </button>
                ))}
                {visibleStickers.length === 0 && search && (
                  <div className="gif-empty">No stickers match "{search}"</div>
                )}
              </div>
            )}
          </div>

          <div className="gif-footer">
            <span style={{ fontSize: 11, color: '#bbb' }}>
              🩷 {currentPack?.nameVi || currentPack?.name || 'Pastel Stickers'} · {visibleStickers.length} stickers
            </span>
            <button
              style={{ fontSize: 11, color: '#DDA0DD', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setTab('store')}
            >+ More</button>
          </div>
        </>
      )}

      {/* ── GIFs tab ── */}
      {tab === 'gifs' && (
        <>
          <div className="gif-scroll">
            {gifsLoading ? (
              <div className="gif-loading">
                {[...Array(12)].map((_, i) => <div key={i} className="gif-skeleton" />)}
              </div>
            ) : gifs.length === 0 ? (
              <div className="gif-empty">No GIFs found 😔</div>
            ) : (
              <div className="gif-grid">
                {gifs.map(item => (
                  <button
                    key={item.id}
                    className="gif-item"
                    onClick={() => sendGif(item)}
                    title={item.title}
                  >
                    <img src={gifPreview(item)} alt={item.title} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="gif-footer">
            <span style={{ fontSize: 11, color: '#bbb' }}>Powered by</span>
            <img
              src="https://developers.giphy.com/branch/master/static/header-logo-8974b8ae658f704a5b48a2d039b8ad93.gif"
              alt="GIPHY"
              style={{ height: 12, marginLeft: 4, opacity: 0.7 }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default GifStickerPicker;
