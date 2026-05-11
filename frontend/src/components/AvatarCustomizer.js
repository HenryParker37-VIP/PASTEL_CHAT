import React, { useState, useCallback } from 'react';
import AVATARS, {
  getAvatarUrl,
  getCharacterAvatarUrl,
  SKIN_COLORS,
  HAIR_COLORS,
  PASTEL_BG_COLORS,
  EXPRESSIONS,
  ACCESSORIES,
  parseCharacterUrl,
  detectAvatarMode,
} from '../data/avatars';

// Translate current avatar URL back to character opts
function initCharacterOpts(avatarUrl) {
  const parsed = parseCharacterUrl(avatarUrl);
  return parsed || {
    skinColor: 'f8d9c4',
    hairColor: '4a2c2c',
    bgColor: 'ffb6c1',
    eyes: 'variant01',
    glasses: '',
    earrings: false,
  };
}

function initStickerState(avatarUrl) {
  try {
    const m = avatarUrl && avatarUrl.match(/[?&]seed=([^&]+)/);
    const seed = m ? decodeURIComponent(m[1]) : AVATARS[0].seed;
    const bgM = avatarUrl && avatarUrl.match(/backgroundColor=([^&]+)/);
    const bgColor = bgM ? bgM[1].split(',')[0] : 'ffb6c1';
    return { seed, bgColor };
  } catch {
    return { seed: AVATARS[0].seed, bgColor: 'ffb6c1' };
  }
}

const SwatchRow = ({ label, items, selected, onSelect, size = 28 }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 600 }}>{label}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(item => (
        <button
          key={item.id}
          title={item.label}
          onClick={() => onSelect(item)}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: `#${item.hex}`,
            border: selected === item.hex ? '3px solid #DDA0DD' : '2px solid transparent',
            outline: selected === item.hex ? '2px solid #DDA0DD' : 'none',
            outlineOffset: 1,
            cursor: 'pointer',
            padding: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            transition: 'transform 0.12s, border-color 0.12s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        />
      ))}
    </div>
  </div>
);

const OptionRow = ({ label, items, selected, onSelect }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 600 }}>{label}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          style={{
            padding: '4px 10px',
            borderRadius: 20,
            border: '1.5px solid',
            borderColor: selected === item.value ? '#DDA0DD' : '#E8D5F0',
            background: selected === item.value ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : 'white',
            color: selected === item.value ? 'white' : '#888',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  </div>
);

const AvatarCustomizer = ({ currentAvatarUrl, onAvatarChange, compact = false }) => {
  const initMode = detectAvatarMode(currentAvatarUrl);
  const [mode, setMode] = useState(initMode === 'photo' ? 'sticker' : initMode);

  // Sticker state
  const [stickerState, setStickerState] = useState(() => initStickerState(currentAvatarUrl));
  const [stickerBgColor, setStickerBgColor] = useState('ffb6c1');

  // Character state
  const [charOpts, setCharOpts] = useState(() => initCharacterOpts(currentAvatarUrl));
  const [charSeed, setCharSeed] = useState('custom');

  const currentStickerUrl = getAvatarUrl(stickerState.seed, stickerState.bgColor);
  const currentCharUrl = getCharacterAvatarUrl({ ...charOpts, seed: charSeed });
  const previewUrl = mode === 'sticker' ? currentStickerUrl : currentCharUrl;

  const commit = useCallback((url) => {
    onAvatarChange(url);
  }, [onAvatarChange]);

  const handleStickerSelect = (seed) => {
    const newState = { ...stickerState, seed };
    setStickerState(newState);
    commit(getAvatarUrl(seed, newState.bgColor));
  };

  const handleStickerBgChange = (colorItem) => {
    const newState = { ...stickerState, bgColor: colorItem.hex };
    setStickerState(newState);
    setStickerBgColor(colorItem.hex);
    commit(getAvatarUrl(newState.seed, colorItem.hex));
  };

  const handleCharChange = (patch) => {
    const next = { ...charOpts, ...patch };
    setCharOpts(next);
    commit(getCharacterAvatarUrl({ ...next, seed: charSeed }));
  };

  const randomizeCharSeed = () => {
    const seed = Math.random().toString(36).slice(2, 10);
    setCharSeed(seed);
    commit(getCharacterAvatarUrl({ ...charOpts, seed }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Preview + mode switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <img
          src={previewUrl}
          alt="Avatar preview"
          style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #F0E4F8', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>Avatar Style</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'sticker', label: '🩷 Sticker' },
              { id: 'character', label: '🎨 Character' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  commit(m.id === 'sticker' ? currentStickerUrl : currentCharUrl);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: '1.5px solid',
                  borderColor: mode === m.id ? '#DDA0DD' : '#E8D5F0',
                  background: mode === m.id ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : 'white',
                  color: mode === m.id ? 'white' : '#888',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sticker mode ──────────────────────────────────────────────────── */}
      {mode === 'sticker' && (
        <>
          <SwatchRow
            label="Background Color"
            items={PASTEL_BG_COLORS}
            selected={stickerBgColor}
            onSelect={handleStickerBgChange}
          />
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 600 }}>Pick a Sticker Face</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
            gap: 6,
            maxHeight: compact ? 160 : 220,
            overflowY: 'auto',
            paddingRight: 2,
          }}>
            {AVATARS.map(av => (
              <button
                key={av.id}
                onClick={() => handleStickerSelect(av.seed)}
                title={av.seed}
                style={{
                  padding: 4,
                  borderRadius: 12,
                  border: '2px solid',
                  borderColor: stickerState.seed === av.seed ? '#DDA0DD' : 'transparent',
                  background: stickerState.seed === av.seed ? '#F7EFF8' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                <img
                  src={getAvatarUrl(av.seed, stickerState.bgColor)}
                  alt={av.seed}
                  style={{ width: 44, height: 44, display: 'block', borderRadius: 8 }}
                />
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Character mode ────────────────────────────────────────────────── */}
      {mode === 'character' && (
        <div style={{ maxHeight: compact ? 300 : 400, overflowY: 'auto', paddingRight: 2 }}>
          <SwatchRow
            label="Skin Tone"
            items={SKIN_COLORS}
            selected={charOpts.skinColor}
            onSelect={item => handleCharChange({ skinColor: item.hex })}
          />
          <SwatchRow
            label="Hair Color"
            items={HAIR_COLORS}
            selected={charOpts.hairColor}
            onSelect={item => handleCharChange({ hairColor: item.hex })}
            size={24}
          />
          <SwatchRow
            label="Background Color"
            items={PASTEL_BG_COLORS}
            selected={charOpts.bgColor}
            onSelect={item => handleCharChange({ bgColor: item.hex })}
          />
          <OptionRow
            label="Expression"
            items={EXPRESSIONS}
            selected={charOpts.eyes}
            onSelect={item => handleCharChange({ eyes: item.value })}
          />
          <OptionRow
            label="Accessories"
            items={ACCESSORIES}
            selected={charOpts.glasses}
            onSelect={item => handleCharChange({ glasses: item.value })}
          />
          {/* Earrings toggle */}
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>Earrings</span>
            <button
              onClick={() => handleCharChange({ earrings: !charOpts.earrings })}
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                border: '1.5px solid',
                borderColor: charOpts.earrings ? '#DDA0DD' : '#E8D5F0',
                background: charOpts.earrings ? 'linear-gradient(135deg, #FFB6C1, #DDA0DD)' : 'white',
                color: charOpts.earrings ? 'white' : '#888',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {charOpts.earrings ? '✓ On' : 'Off'}
            </button>
          </div>
          <button
            onClick={randomizeCharSeed}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 12,
              border: '1.5px dashed #DDA0DD',
              background: 'transparent',
              color: '#DDA0DD',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🎲 Randomize Character
          </button>
        </div>
      )}
    </div>
  );
};

export default AvatarCustomizer;
