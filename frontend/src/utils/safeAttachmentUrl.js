const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'application/zip', 'application/x-zip-compressed',
  'video/mp4', 'audio/mpeg', 'audio/mp4', 'application/octet-stream'
]);
const MAX_INLINE_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export function safeAttachmentDataUrl(value) {
  if (typeof value !== 'string') return null;
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match || !ALLOWED_MIME_TYPES.has(match[1].toLowerCase())) return null;
  const encoded = match[2];
  if (!encoded.length || encoded.length % 4 !== 0 || encoded.length > 4 * Math.ceil(MAX_INLINE_ATTACHMENT_BYTES / 3)) return null;
  try {
    const decoded = atob(encoded);
    if (!decoded.length || decoded.length > MAX_INLINE_ATTACHMENT_BYTES || btoa(decoded) !== encoded) return null;
  } catch {
    return null;
  }
  return value;
}
