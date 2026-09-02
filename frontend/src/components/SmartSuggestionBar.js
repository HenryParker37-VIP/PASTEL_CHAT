import React, { useEffect, useState } from 'react';
import StickerDisplay from './StickerDisplay';
import { LOCAL_STICKERS } from '../data/stickerLibrary';
import { getRecentStickerIds, getFavoriteStickerIds } from '../services/stickerPreferences';
import { getSmartSuggestions } from '../services/smartSuggestions';

const SmartSuggestionBar = ({ message, onStickerSelect, onGifQuery }) => {
  const [suggestions, setSuggestions] = useState({ stickers: [], gifQueries: [] });
  const [pendingMessage, setPendingMessage] = useState(message);

  useEffect(() => {
    const timer = setTimeout(() => setPendingMessage(message), 300);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const result = getSmartSuggestions(pendingMessage, {
      stickers: LOCAL_STICKERS,
      recentIds: getRecentStickerIds(),
      favoriteIds: getFavoriteStickerIds()
    });
    setSuggestions(result);
  }, [pendingMessage]);

  if (!suggestions.stickers.length && !suggestions.gifQueries.length) return null;
  return (
    <div className="smart-suggestion-bar" role="region" aria-label="Smart sticker and GIF suggestions">
      <span className="smart-suggestion-title">Suggestions</span>
      <div className="smart-suggestion-items">
        {suggestions.stickers.slice(0, 3).map(item => (
          <button key={item.id} className="smart-suggestion-sticker" type="button" title={item.labelVi || item.label} onClick={() => onStickerSelect(item)}>
            <StickerDisplay imageUrl={item.asset} label={item.labelVi || item.label} size="small" allowEmojiFallback={false} />
          </button>
        ))}
        {suggestions.gifQueries.slice(0, 2).map(query => (
          <button key={query} className="smart-suggestion-gif" type="button" onClick={() => onGifQuery(query)} title={`Search GIFs for ${query}`}>
            <span aria-hidden="true">GIF</span><span>{query}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SmartSuggestionBar;
