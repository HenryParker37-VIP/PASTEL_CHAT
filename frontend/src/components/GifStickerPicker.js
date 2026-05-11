import React, { useState, useEffect, useRef, useCallback } from 'react';

const GIPHY_KEY = process.env.REACT_APP_GIPHY_API_KEY || '';
const BASE = 'https://api.giphy.com/v1';
const LIMIT = 24;

// ── Built-in emoji sticker packs (no API key needed) ────────────────────────
const STICKER_PACKS = [
  {
    id: 'love',
    label: '💕 Love',
    stickers: ['❤️','💕','💖','💗','💓','💞','💘','💝','🥰','😍','😘','💋','💌','💑','👫','🫶','❣️','💟','🩷','🫀'],
  },
  {
    id: 'happy',
    label: '😊 Happy',
    stickers: ['😀','😃','😄','😁','🥳','🎉','🎊','✨','🌟','⭐','🌈','😊','😉','🤗','😆','🥰','🤩','😎','🙌','👏'],
  },
  {
    id: 'animals',
    label: '🐱 Cute Animals',
    stickers: ['🐱','🐶','🐰','🐹','🐻','🐼','🐨','🦊','🐸','🐧','🦋','🐝','🦄','🐙','🦋','🐳','🦭','🦝','🐻‍❄️','🦔'],
  },
  {
    id: 'food',
    label: '🍰 Sweets',
    stickers: ['🍰','🧁','🎂','🍩','🍪','🍫','🍭','🍬','🧇','🍡','🌮','🍜','🍣','🍕','🧋','🍓','🍑','🍒','🍇','🫐'],
  },
  {
    id: 'nature',
    label: '🌸 Nature',
    stickers: ['🌸','🌺','🌻','🌹','🌷','🌼','💐','🌿','🍀','🌱','🌙','☀️','🌊','🦋','🌈','⛅','🌸','🪷','🌴','🍁'],
  },
  {
    id: 'celebrate',
    label: '🎉 Party',
    stickers: ['🎉','🎊','🎈','🎁','🎀','🥂','🍾','🎆','🎇','✨','🌟','💫','⭐','🎵','🎶','🎸','🎹','🥳','🏆','🎯'],
  },
  {
    id: 'mood',
    label: '😅 Moods',
    stickers: ['😭','😢','🥺','😬','😤','😡','🤯','😱','😰','😓','🤔','🤷','🤦','🙄','😴','🥱','😶','🤐','😏','😌'],
  },
  {
    id: 'magic',
    label: '✨ Magic',
    stickers: ['✨','💫','⭐','🌟','🔮','🪄','🧿','🌙','💎','👑','🦄','🧚','🧜','🧝','🪐','🌌','🔭','💠','🫧','🌀'],
  },
];

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

// Tabs shown depend on whether a Giphy key exists
const buildTabs = () => {
  const tabs = [{ id: 'stickers', label: '🩷 Stickers' }];
  if (GIPHY_KEY) {
    tabs.push({ id: 'gifs', label: '🎞️ GIFs' });
    tabs.push({ id: 'animated', label: '✨ Animated' });
  }
  return tabs;
};
const TABS = buildTabs();

const GifStickerPicker = ({ keyword = '', onSelect, onClose }) => {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [activePack, setActivePack] = useState(STICKER_PACKS[0].id);
  const [search, setSearch] = useState('');
  const [giphyItems, setGiphyItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const loadGiphy = useCallback(async (query, tab) => {
    if (!GIPHY_KEY) return;
    setLoading(true);
    try {
      const isSticker = tab === 'animated';
      const endpoint = query
        ? isSticker ? '/stickers/search' : '/gifs/search'
        : isSticker ? '/stickers/trending' : '/gifs/trending';
      const params = query ? { q: query } : {};
      const data = await fetchGiphy(endpoint, params);
      setGiphyItems(data);
    } catch (e) {
      console.error('[GifPicker]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'stickers') {
      loadGiphy(search, activeTab);
    }
  }, [activeTab, loadGiphy]); // eslint-disable-line

  useEffect(() => {
    if (activeTab === 'stickers') return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadGiphy(search, activeTab), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search, activeTab, loadGiphy]);

  // Filter stickers by search when in sticker mode
  const currentPack = STICKER_PACKS.find(p => p.id === activePack) || STICKER_PACKS[0];
  const filteredStickers = search.trim()
    ? STICKER_PACKS.flatMap(p => p.stickers).filter(s => {
        // Basic: show stickers from packs whose label matches, or all
        return true;
      })
    : currentPack.stickers;

  const handleSelectEmoji = (emoji) => {
    onSelect({ type: 'emoji-sticker', url: null, preview: null, emoji, title: emoji });
  };

  const handleSelectGiphy = (item) => {
    onSelect({
      type: 'gif',
      url: extractUrl(item),
      preview: extractPreview(item),
      title: item.title || '',
    });
  };

  return (
    <div className="gif-picker" onClick={e => e.stopPropagation()}>
      {/* Header tabs */}
      <div className="gif-picker-header">
        <div className="gif-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`gif-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setSearch(''); }}
            >{tab.label}</button>
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
          placeholder={activeTab === 'stickers' ? 'Filter stickers…' : 'Search GIFs…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        {search && (
          <button className="gif-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Built-in emoji stickers */}
      {activeTab === 'stickers' && (
        <>
          {/* Pack selector */}
          {!search && (
            <div className="sticker-pack-tabs">
              {STICKER_PACKS.map(pack => (
                <button
                  key={pack.id}
                  className={`sticker-pack-tab ${activePack === pack.id ? 'active' : ''}`}
                  onClick={() => setActivePack(pack.id)}
                  title={pack.label}
                >
                  {pack.label.split(' ')[0]}
                </button>
              ))}
            </div>
          )}
          <div className="gif-scroll">
            <div className="gif-grid sticker-emoji-grid">
              {(search.trim()
                ? STICKER_PACKS.flatMap(p => p.stickers).filter((_, i) => i < 40)
                : currentPack.stickers
              ).map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  className="sticker-emoji-btn"
                  onClick={() => handleSelectEmoji(emoji)}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Giphy GIFs / Animated stickers */}
      {activeTab !== 'stickers' && (
        <div className="gif-scroll">
          {loading ? (
            <div className="gif-loading">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="gif-skeleton" />
              ))}
            </div>
          ) : giphyItems.length === 0 ? (
            <div className="gif-empty">No results found 😔</div>
          ) : (
            <div className="gif-grid">
              {giphyItems.map(item => (
                <button
                  key={item.id}
                  className="gif-item"
                  onClick={() => handleSelectGiphy(item)}
                  title={item.title}
                >
                  <img src={extractPreview(item)} alt={item.title} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="gif-footer">
        {activeTab === 'stickers' ? (
          <span style={{ fontSize: 10, color: '#ccc' }}>🩷 Built-in Pastel Stickers</span>
        ) : (
          <img
            src="https://developers.giphy.com/branch/master/static/header-logo-8974b8ae658f704a5b48a2d039b8ad93.gif"
            alt="Powered by GIPHY"
            style={{ height: 14, opacity: 0.6 }}
          />
        )}
      </div>
    </div>
  );
};

export default GifStickerPicker;
