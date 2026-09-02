// Curated, low-saturation colors keep conversations distinct without competing
// with message text or the existing cream/pastel surfaces.
export const PASTEL_IDENTITY_PALETTE = [
  { accent: '#E49AB0', soft: '#FFF0F4' },
  { accent: '#B596D6', soft: '#F5F0FB' },
  { accent: '#7DB7CC', soft: '#EEF8FC' },
  { accent: '#79B99D', soft: '#EEF8F3' },
  { accent: '#D7AD72', soft: '#FFF8EB' },
  { accent: '#B5A2D8', soft: '#F4F0FB' },
  { accent: '#D69A82', soft: '#FFF3EE' },
];

const stableHash = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < String(value || '').length; i += 1) {
    hash ^= String(value || '').charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const getPastelIdentity = (identity) => (
  PASTEL_IDENTITY_PALETTE[stableHash(identity) % PASTEL_IDENTITY_PALETTE.length]
);
