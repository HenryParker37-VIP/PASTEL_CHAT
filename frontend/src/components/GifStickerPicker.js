import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import StickerStore from './StickerStore';
import PastelIcon from './PastelIcon';
import StickerDisplay from './StickerDisplay';
import { LOCAL_STICKER_PACKS, LOCAL_STICKERS } from '../data/stickerPacks';
import { getRecentStickerIds, getFavoriteStickerIds, recordRecentSticker, toggleFavoriteSticker } from '../services/stickerPreferences';
import { getSmartSuggestions } from '../services/smartSuggestions';

const GIPHY_KEY = process.env.REACT_APP_GIPHY_API_KEY || '';
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';
const LIMIT = 20;

async function fetchGiphy(endpoint, params = {}, signal) {
  if (!GIPHY_KEY) throw new Error('GIF service is not configured');
  const url = new URL(`${GIPHY_BASE}${endpoint}`);
  url.searchParams.set('api_key', GIPHY_KEY); url.searchParams.set('limit', LIMIT); url.searchParams.set('rating', 'pg');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error(`GIF service returned ${res.status}`);
  const data = await res.json(); return data.data || [];
}
const image = (item, preferred) => item?.images?.[preferred] || item?.images?.original || {};
const gifMeta = (item) => { const original = image(item, 'original'); const preview = image(item, 'fixed_width_small'); return {
  type: 'gif', url: original.url, previewUrl: preview.url || original.url, preview: preview.url || original.url,
  width: Number(original.width) || Number(preview.width) || null, height: Number(original.height) || Number(preview.height) || null,
  provider: 'giphy', sourceId: item.id, name: item.title || item.content_description || 'GIF'
}; };

const GifStickerPicker = ({ keyword = '', initialTab = 'stickers', initialSearch = '', onSelect, onClose }) => {
  const [tab, setTab] = useState(initialTab); const [search, setSearch] = useState(initialSearch); const [category, setCategory] = useState('pastel');
  const [recentIds, setRecentIds] = useState(getRecentStickerIds); const [favoriteIds, setFavoriteIds] = useState(getFavoriteStickerIds);
  const [gifs, setGifs] = useState([]); const [gifsLoading, setGifsLoading] = useState(false); const [gifError, setGifError] = useState(null);
  const abortRef = useRef(null);
  useEffect(() => { setTab(initialTab); setSearch(initialSearch); }, [initialTab, initialSearch]);
  const loadGifs = useCallback(async (query) => { abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller; setGifsLoading(true); setGifError(null);
    try { setGifs(await fetchGiphy(query ? '/search' : '/trending', query ? { q: query } : {}, controller.signal)); }
    catch (error) { if (error.name !== 'AbortError') { setGifError('GIFs could not load. Retry or choose a sticker.'); setGifs([]); } }
    finally { if (!controller.signal.aborted) setGifsLoading(false); }
  }, []);
  useEffect(() => { if (tab === 'gifs') loadGifs(''); return () => abortRef.current?.abort(); }, [tab, loadGifs]);
  useEffect(() => { if (tab !== 'gifs') return undefined; const timer = setTimeout(() => loadGifs(search.trim()), 350); return () => clearTimeout(timer); }, [search, tab, loadGifs]);

  const suggestions = useMemo(() => getSmartSuggestions(keyword, { stickers: LOCAL_STICKERS, recentIds, favoriteIds }), [keyword, recentIds, favoriteIds]);
  const activePack = LOCAL_STICKER_PACKS.find(pack => pack.id === category); const term = search.trim().toLowerCase();
  const visibleStickers = useMemo(() => { let list = category === 'recent' ? recentIds.map(id => LOCAL_STICKERS.find(item => item.id === id)).filter(Boolean) : category === 'favorites' ? favoriteIds.map(id => LOCAL_STICKERS.find(item => item.id === id)).filter(Boolean) : activePack?.stickers || [];
    return term ? LOCAL_STICKERS.filter(item => [item.label, item.labelVi, ...(item.tags?.en || []), ...(item.tags?.vi || [])].join(' ').toLowerCase().includes(term)) : list;
  }, [activePack, category, favoriteIds, recentIds, term]);
  const sendSticker = item => { setRecentIds(recordRecentSticker(item.id)); onSelect({ type: 'sticker', stickerId: item.id, pack: item.pack, imageUrl: item.asset, label: item.labelVi || item.label, name: item.label }); onClose(); };
  const favorite = (event, item) => { event.stopPropagation(); setFavoriteIds(toggleFavoriteSticker(item.id)); };
  const selectTab = next => { setTab(next); setSearch(''); };
  if (tab === 'store') return <div className="gif-picker" onClick={event => event.stopPropagation()}><StickerStore onClose={onClose} onPacksChanged={() => selectTab('stickers')} /></div>;
  return <div className="gif-picker" onClick={event => event.stopPropagation()}>
    <div className="gif-picker-header"><div className="gif-tabs"><button className={`gif-tab ${tab === 'stickers' ? 'active' : ''}`} onClick={() => selectTab('stickers')}><PastelIcon name="gift" size={15} /> Stickers</button><button className={`gif-tab ${tab === 'gifs' ? 'active' : ''}`} onClick={() => selectTab('gifs')}><PastelIcon name="gif" size={15} /> GIFs</button><button className="gif-tab" onClick={() => setTab('store')}><PastelIcon name="gift" size={15} /> Store</button></div><button className="gif-close" onClick={onClose} aria-label="Close picker"><PastelIcon name="close" size={16} /></button></div>
    <div className="gif-search-wrap"><PastelIcon className="gif-search-icon" name="search" size={16} /><input className="gif-search-input" placeholder={tab === 'stickers' ? 'Search stickers in English or Vietnamese…' : 'Search GIFs…'} value={search} onChange={event => setSearch(event.target.value)} />{search && <button className="gif-search-clear" onClick={() => setSearch('')} aria-label="Clear search"><PastelIcon name="close" size={14} /></button>}</div>
    {tab === 'stickers' && <><div className="sticker-category-tabs" role="tablist" aria-label="Sticker categories"><button className={`sticker-category-tab ${category === 'recent' ? 'active' : ''}`} onClick={() => setCategory('recent')}>Recent</button><button className={`sticker-category-tab ${category === 'favorites' ? 'active' : ''}`} onClick={() => setCategory('favorites')}>Favorites</button>{LOCAL_STICKER_PACKS.map(pack => <button key={pack.id} className={`sticker-category-tab ${category === pack.id ? 'active' : ''}`} onClick={() => setCategory(pack.id)}>{pack.name}</button>)}</div>{!!suggestions.stickers.length && !search && <div className="sticker-suggestions" aria-label="Suggested stickers"><span className="sticker-suggestion-label">For this message</span>{suggestions.stickers.map(item => <button key={item.id} className="sticker-suggestion" onClick={() => sendSticker(item)} title={item.labelVi}><StickerDisplay imageUrl={item.asset} label={item.labelVi} size="small" /></button>)}</div>}<div className="gif-scroll"><div className="gif-grid sticker-emoji-grid">{visibleStickers.map(item => <button key={item.id} className="sticker-emoji-btn sticker-asset-btn" onClick={() => sendSticker(item)} title={item.labelVi || item.label}><StickerDisplay imageUrl={item.asset} label={item.labelVi || item.label} size="small" /><span className="sticker-favorite-btn" role="button" aria-label={`${favoriteIds.includes(item.id) ? 'Remove from' : 'Add to'} favorites`} onClick={event => favorite(event, item)}>{favoriteIds.includes(item.id) ? '★' : '☆'}</span></button>)}{!visibleStickers.length && <div className="gif-empty">{category === 'favorites' ? 'Favorite stickers will appear here.' : 'No stickers match that search.'}</div>}</div></div><div className="gif-footer"><span>{activePack?.nameVi || (category === 'recent' ? 'Recently used' : category === 'favorites' ? 'Favorites' : 'Pastel Stickers')} · {visibleStickers.length}</span><button onClick={() => setTab('store')}>+ More</button></div></>}
    {tab === 'gifs' && <><div className="gif-scroll">{gifsLoading ? <div className="gif-loading">{[...Array(12)].map((_, index) => <div key={index} className="gif-skeleton" />)}</div> : gifError ? <div className="gif-empty"><PastelIcon name="alert" size={32} /><p>{gifError}</p><button className="btn btn-ghost" onClick={() => loadGifs(search)}>Retry</button></div> : <div className="gif-grid">{gifs.map(item => <button key={item.id} className="gif-item" onClick={() => { onSelect(gifMeta(item)); onClose(); }} title={item.title}><img src={image(item, 'fixed_height').url || image(item, 'original').url} alt={item.title || 'GIF'} loading="lazy" /></button>)}</div>}</div><div className="gif-footer"><span>Powered by GIPHY</span>{suggestions.gifQueries[0] && <button onClick={() => { setSearch(suggestions.gifQueries[0]); loadGifs(suggestions.gifQueries[0]); }}>Try a suggested GIF</button>}</div></>}
  </div>;
};
export default GifStickerPicker;
