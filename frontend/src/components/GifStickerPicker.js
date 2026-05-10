import React, { useState, useEffect, useRef, useCallback } from 'react';

const GIPHY_KEY = process.env.REACT_APP_GIPHY_API_KEY || '';
const BASE = 'https://api.giphy.com/v1';
const LIMIT = 24;

async function fetchGiphy(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_key', GIPHY_KEY);
  url.searchParams.set('limit', LIMIT);
  url.searchParams.set('rating', 'g');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Giphy request failed');
  const json = await res.json();
  return json.data;
}

function extractUrl(item) {
  return item?.images?.fixed_height?.url || item?.images?.original?.url || '';
}
function extractPreview(item) {
  return item?.images?.fixed_height_small?.url || item?.images?.fixed_height?.url || '';
}

const TABS = ['GIFs', 'Stickers'];

const GifStickerPicker = ({ keyword = '', onSelect, onClose }) => {
  const [activeTab, setActiveTab] = useState('GIFs');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const load = useCallback(async (query, tab) => {
    if (!GIPHY_KEY) return;
    setLoading(true);
    try {
      const isSticker = tab === 'Stickers';
      const endpoint = query
        ? isSticker ? '/stickers/search' : '/gifs/search'
        : isSticker ? '/stickers/trending' : '/gifs/trending';
      const params = query ? { q: query } : {};
      const data = await fetchGiphy(endpoint, params);
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load suggestions based on keyword user is typing in message box
  const loadSuggested = useCallback(async (kw, tab) => {
    if (!GIPHY_KEY || !kw.trim()) { setSuggested([]); return; }
    try {
      const isSticker = tab === 'Stickers';
      const endpoint = isSticker ? '/stickers/search' : '/gifs/search';
      const data = await fetchGiphy(endpoint, { q: kw, limit: 8 });
      setSuggested(data);
    } catch (e) {
      setSuggested([]);
    }
  }, []);

  // Initial load & tab change
  useEffect(() => {
    load(search, activeTab);
  }, [activeTab, load]); // eslint-disable-line

  // Search debounce
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(search, activeTab), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search, activeTab, load]);

  // Keyword suggestions from chat input
  useEffect(() => {
    loadSuggested(keyword, activeTab);
  }, [keyword, activeTab, loadSuggested]);

  const handleSelect = (item) => {
    onSelect({
      url: extractUrl(item),
      preview: extractPreview(item),
      title: item.title || '',
    });
  };

  const showSuggested = suggested.length > 0 && !search;

  return (
    <div className="gif-picker" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="gif-picker-header">
        <div className="gif-tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`gif-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >{tab}</button>
          ))}
        </div>
        <button className="gif-close" onClick={onClose}>✕</button>
      </div>

      {/* Search */}
      <div className="gif-search-wrap">
        <span className="gif-search-icon">🔍</span>
        <input
          ref={searchRef}
          className="gif-search-input"
          placeholder={`Search ${activeTab}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        {search && (
          <button className="gif-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Keyword suggestions strip */}
      {showSuggested && (
        <div className="gif-suggestions">
          <div className="gif-suggestions-label">✨ Based on what you're typing</div>
          <div className="gif-grid gif-grid-suggest">
            {suggested.map(item => (
              <button
                key={item.id}
                className="gif-item"
                onClick={() => handleSelect(item)}
                title={item.title}
              >
                <img src={extractPreview(item)} alt={item.title} loading="lazy" />
              </button>
            ))}
          </div>
          <div className="gif-suggestions-divider">All {activeTab}</div>
        </div>
      )}

      {/* Main grid */}
      <div className="gif-scroll">
        {!GIPHY_KEY ? (
          <div className="gif-no-key">
            <span>🔑</span>
            <p>Add <code>REACT_APP_GIPHY_API_KEY</code> to your <code>.env</code> to enable {activeTab}.</p>
            <a href="https://developers.giphy.com/" target="_blank" rel="noreferrer">Get a free key →</a>
          </div>
        ) : loading ? (
          <div className="gif-loading">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="gif-skeleton" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="gif-empty">No results found 😔</div>
        ) : (
          <div className="gif-grid">
            {items.map(item => (
              <button
                key={item.id}
                className="gif-item"
                onClick={() => handleSelect(item)}
                title={item.title}
              >
                <img src={extractPreview(item)} alt={item.title} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Powered by Giphy */}
      <div className="gif-footer">
        <img
          src="https://developers.giphy.com/branch/master/static/header-logo-8974b8ae658f704a5b48a2d039b8ad93.gif"
          alt="Powered by GIPHY"
          style={{ height: 14, opacity: 0.6 }}
        />
      </div>
    </div>
  );
};

export default GifStickerPicker;
