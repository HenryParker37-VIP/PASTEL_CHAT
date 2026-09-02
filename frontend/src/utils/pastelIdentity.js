// Curated, low-saturation colors keep conversations distinct without competing
// with message text or the existing cream/pastel surfaces.
export const PASTEL_IDENTITY_PALETTE = [
  { id: 'pink', label: 'Pink', accent: '#E49AB0', soft: '#FFF0F4', bubble: '#E9A8BE', text: '#573746' },
  { id: 'lavender', label: 'Lavender', accent: '#B596D6', soft: '#F5F0FB', bubble: '#C6AFE0', text: '#443650' },
  { id: 'lilac', label: 'Lilac', accent: '#B5A2D8', soft: '#F4F0FB', bubble: '#CBBCE4', text: '#43394F' },
  { id: 'baby-blue', label: 'Baby blue', accent: '#7DB7CC', soft: '#EEF8FC', bubble: '#A8D3E2', text: '#284450' },
  { id: 'sky-blue', label: 'Sky blue', accent: '#78AFCB', soft: '#EEF7FC', bubble: '#A6CFE3', text: '#284250' },
  { id: 'mint', label: 'Mint', accent: '#79B99D', soft: '#EEF8F3', bubble: '#A8D8BE', text: '#28483A' },
  { id: 'sage', label: 'Sage', accent: '#91AE91', soft: '#F1F7F0', bubble: '#B5D0B3', text: '#304632' },
  { id: 'peach', label: 'Peach', accent: '#D69A82', soft: '#FFF3EE', bubble: '#EDB7A1', text: '#58382D' },
  { id: 'apricot', label: 'Apricot', accent: '#D7AD72', soft: '#FFF8EB', bubble: '#EBC58F', text: '#534126' },
  { id: 'yellow', label: 'Pastel yellow', accent: '#C9AA62', soft: '#FFFBEF', bubble: '#E7D28E', text: '#514522' },
  { id: 'cream', label: 'Cream', accent: '#B9A17C', soft: '#FFFBF2', bubble: '#E8D9B8', text: '#4D412F' },
  { id: 'rose', label: 'Dusty rose', accent: '#B98296', soft: '#FBF0F4', bubble: '#D9A9B9', text: '#523642' },
  { id: 'coral', label: 'Soft coral', accent: '#D58E88', soft: '#FFF2F0', bubble: '#E7ADA7', text: '#543331' },
  { id: 'periwinkle', label: 'Periwinkle', accent: '#8999C8', soft: '#F1F4FC', bubble: '#ACB9DC', text: '#303A58' },
  { id: 'teal', label: 'Soft teal', accent: '#70A9A2', soft: '#EDF8F7', bubble: '#9FCAC5', text: '#294743' },
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

export const getPastelColor = (id) => (
  PASTEL_IDENTITY_PALETTE.find((color) => color.id === id) || null
);
