const MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'application/zip', 'application/x-zip-compressed',
  'video/mp4', 'audio/mpeg', 'audio/mp4', 'application/octet-stream'
]);

function parseInlineAttachment(value, maxBytes) {
  if (typeof value !== 'string' || !Number.isSafeInteger(maxBytes) || maxBytes < 1) return null;
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match || !MIME_TYPES.has(match[1].toLowerCase())) return null;
  const encoded = match[2];
  if (encoded.length % 4 !== 0 || encoded.length > 4 * Math.ceil(maxBytes / 3)) return null;
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > maxBytes || bytes.toString('base64') !== encoded) return null;
  return { dataUrl: value, size: bytes.length, mimeType: match[1].toLowerCase() };
}

function createInlineMedia(media, maxBytes) {
  if (!media || typeof media !== 'object' || typeof media.name !== 'string') return null;
  const parsed = parseInlineAttachment(media.dataUrl, maxBytes);
  if (!parsed) return null;
  const image = parsed.mimeType.startsWith('image/');
  if (media.type === 'image' && !image) return null;
  if (media.type !== 'image' && image) return null;
  return {
    type: image ? 'image' : 'file',
    dataUrl: parsed.dataUrl,
    name: media.name.slice(0, 200),
    size: parsed.size
  };
}

module.exports = { MIME_TYPES, parseInlineAttachment, createInlineMedia };
