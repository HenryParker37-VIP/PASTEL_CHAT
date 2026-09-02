import React, { useMemo, useState } from 'react';
import StickerDisplay from './StickerDisplay';
import PastelIcon from './PastelIcon';
import { LOCAL_STICKER_PACKS } from '../data/stickerLibrary';
import { getInstalledPackIds, toggleInstalledPack } from '../services/stickerPreferences';

const PackSheet = ({ pack, variant = 'card' }) => (
  <img
    className={`store-pack-sheet store-pack-sheet-${variant}`}
    src={pack.cover}
    alt={`${pack.name} sticker pack preview`}
    loading={variant === 'hero' ? 'eager' : 'lazy'}
  />
);

const StickerStore = ({ onClose, onPacksChanged }) => {
  const [selected, setSelected] = useState(null); const [installed, setInstalled] = useState(getInstalledPackIds); const [query, setQuery] = useState('');
  const packs = useMemo(() => LOCAL_STICKER_PACKS.filter(pack => `${pack.name} ${pack.nameVi} ${(pack.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase().trim())), [query]);
  const togglePack = pack => { const next = toggleInstalledPack(pack.id); setInstalled(next); onPacksChanged?.(); };
  if (selected) return <div className="sticker-store" onClick={event => event.stopPropagation()}>
    <div className="sticker-store-header"><button className="store-back-btn" onClick={() => setSelected(null)} aria-label="Back"><PastelIcon name="arrow-left" size={18} /></button><span className="store-title">{selected.nameVi || selected.name}</span><button className="gif-close" onClick={onClose} aria-label="Close"><PastelIcon name="close" size={18} /></button></div>
    <div className="store-pack-info"><div className="store-pack-cover-lg"><PackSheet pack={selected} variant="detail" /></div><div><div className="store-pack-name">{selected.nameVi || selected.name}</div><div className="store-pack-desc">{selected.description}</div><div className="store-pack-count">{selected.stickers.length} stickers · Source pack</div></div></div>
    <div className="store-preview-grid">{selected.stickers.map(sticker => <div key={sticker.id} className="store-preview-item" title={sticker.labelVi || sticker.label}><StickerDisplay imageUrl={sticker.asset} label={sticker.labelVi || sticker.label} size="medium" /></div>)}</div>
    <div className="store-detail-footer"><button className={`btn ${installed.includes(selected.id) ? 'btn-ghost' : 'btn-blue'}`} style={{ width: '100%', padding: '12px' }} onClick={() => togglePack(selected)}>{installed.includes(selected.id) ? 'Installed on this device' : '+ Add to my stickers'}</button></div>
  </div>;
  return <div className="sticker-store" onClick={event => event.stopPropagation()}>
    <div className="sticker-store-header"><span className="store-title"><PastelIcon name="gift" size={20} /> Sticker Store</span><button className="gif-close" onClick={onClose} aria-label="Close"><PastelIcon name="close" size={18} /></button></div>
    <div className="store-hero"><div><span className="store-eyebrow">PASTELCHAT ORIGINALS</span><h2>Small characters, big feelings.</h2><p>Find a gentle reaction for every conversation.</p></div><PackSheet pack={LOCAL_STICKER_PACKS[0]} variant="hero" /></div>
    <div className="store-search"><PastelIcon name="search" size={15} /><input aria-label="Search sticker packs" placeholder="Search characters or moods…" value={query} onChange={event => setQuery(event.target.value)} /></div>
    <div className="store-subtitle">Featured and available · {packs.length} character packs</div>
    <div className="store-pack-grid">{packs.map(pack => <article key={pack.id} className="store-pack-card"><button className="store-pack-open" onClick={() => setSelected(pack)}><div className="store-pack-cover"><PackSheet pack={pack} /></div><div className="store-pack-card-body"><div className="store-pack-name">{pack.nameVi || pack.name}</div><div className="store-pack-desc">{pack.description}</div><div className="store-pack-count">{pack.stickers.length} stickers</div></div></button><div className="store-card-actions"><span>{pack.featured ? 'Featured' : 'Source pack'}</span><button className={`store-install-btn ${installed.includes(pack.id) ? 'installed' : ''}`} onClick={() => togglePack(pack)}>{installed.includes(pack.id) ? 'Added' : '+ Add'}</button></div></article>)}</div>
  </div>;
};
export default StickerStore;
