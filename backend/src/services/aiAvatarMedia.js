const crypto = require('crypto');

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function parseAvatarDataUrl(value) {
  if (typeof value !== 'string') throw new Error('Avatar image is required');
  const match = value.trim().match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) throw new Error('Avatar must be a JPEG, PNG, or WEBP image');

  const contentType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!MIME_TYPES.has(contentType) || buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) {
    throw new Error('Avatar image must be between 1 byte and 2 MB');
  }
  if (buffer.toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) {
    throw new Error('Avatar image encoding is invalid');
  }

  return {
    buffer,
    contentType,
    version: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

function avatarMediaPath(version) {
  if (!/^[a-f0-9]{64}$/i.test(String(version || ''))) throw new Error('Avatar version is invalid');
  return `/ai/avatar/media/${String(version).toLowerCase()}`;
}

module.exports = { MAX_AVATAR_BYTES, parseAvatarDataUrl, avatarMediaPath };
