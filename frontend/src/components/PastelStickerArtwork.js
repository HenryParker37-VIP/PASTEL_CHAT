import React from 'react';
import { STICKER_CHARACTERS } from '../data/stickerLibrary';

const fallback = { id: 'pastel-bunny', name: 'Pastel Bunny', shape: 'bunny', fill: '#F6D3E4', ink: '#96687C' };
const findCharacter = (asset = '') => {
  const characterId = asset.replace(/^vector:/, '').split('-').slice(0, -1).join('-');
  return STICKER_CHARACTERS.find(character => character.id === characterId) || fallback;
};

const PastelStickerArtwork = ({ asset, label, size = 48 }) => {
  const character = findCharacter(asset);
  const expression = asset.split('-').pop();
  const isSleepy = ['sleep', 'tired', 'sad'].includes(expression);
  const isExcited = ['happy', 'laugh', 'celebrate', 'shock', 'clap'].includes(expression);
  const body = character.shape === 'dino' || character.shape === 'dragon' ? <path d="M37 68c-3-17 7-30 25-30s30 13 27 30c-2 12-12 18-28 18S40 80 37 68Z" fill={character.fill} stroke={character.ink} strokeWidth="3" /> : <ellipse cx="64" cy="63" rx="31" ry="28" fill={character.fill} stroke={character.ink} strokeWidth="3" />;
  return <svg className="pastel-sticker-art" width={size} height={size} viewBox="0 0 128 128" role="img" aria-label={label} focusable="false">
    <circle cx="64" cy="64" r="58" fill="#FFF8F4" />
    {character.shape === 'bunny' && <><path d="M42 39 35 10c-1-6 7-8 11-3l14 25M86 39l7-29c1-6-7-8-11-3L68 32" fill={character.fill} stroke={character.ink} strokeWidth="3" strokeLinejoin="round" /></>}
    {character.shape === 'cat' && <path d="M38 42 37 16l22 16M90 42l1-26-22 16" fill={character.fill} stroke={character.ink} strokeWidth="3" strokeLinejoin="round" />}
    {character.shape !== 'bunny' && character.shape !== 'cat' && <path d="M43 42c-12-12-5-25 6-20 5-12 20-12 25-2 10-8 21 2 13 17" fill={character.fill} stroke={character.ink} strokeWidth="3" />}
    {body}
    {isExcited && <path d="m20 40 7 3m74-3-7 3M28 72l-7 4m86-4 7 4" stroke="#E6B77D" strokeWidth="3" strokeLinecap="round" />}
    <ellipse cx="53" cy="60" rx="3.5" ry="5" fill={character.ink} />
    <ellipse cx="75" cy="60" rx="3.5" ry="5" fill={character.ink} />
    {isSleepy ? <path d="M49 73q6 4 12 0m6 0q6 4 12 0" fill="none" stroke={character.ink} strokeWidth="3" strokeLinecap="round" /> : <path d={expression === 'sad' || expression === 'cry' ? 'M53 78q11-8 22 0' : 'M53 72q11 12 22 0'} fill="none" stroke={character.ink} strokeWidth="3" strokeLinecap="round" />}
    {['love', 'hug', 'thanks', 'flirty'].includes(expression) && <><path d="M100 22c-5-8-17-2-12 7 5 7 12 11 12 11s7-4 12-11c5-9-7-15-12-7Z" fill="#F2A8B8" stroke="#B66D7D" strokeWidth="2" /><path d="M22 24 25 31l7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#F5CF8E" /></>}
    {isExcited && <path d="m95 82 3 6 6 3-6 3-3 7-3-7-6-3 6-3Z" fill="#F4CD8A" />}
  </svg>;
};

export default PastelStickerArtwork;
