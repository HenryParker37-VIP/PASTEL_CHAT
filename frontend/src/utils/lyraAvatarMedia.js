export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
const AVATAR_EDGE = 512;

export function resolveAvatarAsset(value, pageOrigin = typeof window !== 'undefined' ? (window.location?.origin || '') : '') {
  const avatar = typeof value === 'string' ? value.trim() : '';
  if (!avatar || /^(?:data:|blob:|https?:\/\/)/i.test(avatar)) return avatar;
  if (!avatar.startsWith('/ai/avatar/media/')) return avatar;
  let base = (process.env.REACT_APP_BACKEND_URL || '').trim();
  if (base.includes('onrender.com')) base = '';
  base = base || pageOrigin;
  return base ? new URL(avatar, base).toString() : avatar;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This image format could not be opened. Choose a JPEG, PNG, or WEBP photo.'));
    };
    image.src = objectUrl;
  });
}

export async function prepareLyraAvatarUpload(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Please select an image file.');
  }
  if (file.size > MAX_AVATAR_FILE_BYTES) throw new Error('Image must be under 5 MB.');

  const { image, objectUrl } = await loadImageFromFile(file);
  try {
    const scale = Math.min(1, AVATAR_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare this image. Please try another photo.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      previewUrl: objectUrl,
      dataUrl: canvas.toDataURL('image/jpeg', 0.82),
      dispose() { URL.revokeObjectURL(objectUrl); }
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
