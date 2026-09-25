import api from './api';

const CHUNK_LENGTH = 1024 * 1024;

export async function uploadSharedPhoto(dataUrl, { caption = '', expiration = 'never', durationMs } = {}) {
  const mediaType = dataUrl?.startsWith('data:video/') ? 'video' : dataUrl?.startsWith('data:image/') ? 'image' : null;
  if (!mediaType) throw new Error('Unsupported media type');
  const chunks = Math.ceil(dataUrl.length / CHUNK_LENGTH);
  if (chunks > 12) throw new Error('Media is too large');
  const { data: upload } = await api.post('/private-space/shared-photos/uploads', { caption, expiration, mediaType, durationMs });
  for (let index = 0; index < chunks; index += 1) {
    await api.put(`/private-space/shared-photos/uploads/${upload.uploadId}/chunks/${index}`, {
      data: dataUrl.slice(index * CHUNK_LENGTH, (index + 1) * CHUNK_LENGTH)
    });
  }
  const { data } = await api.post(`/private-space/shared-photos/uploads/${upload.uploadId}/complete`, { chunkCount: chunks });
  return data.photo;
}

export async function loadSharedPhoto(photo, userId) {
  if (!photo?.chunkCount || photo.dataUrl || (photo.isHidden && String(photo.uploadedBy?._id) !== String(userId))) return photo;
  const pieces = [];
  for (let index = 0; index < photo.chunkCount; index += 1) {
    const { data } = await api.get(`/private-space/shared-photos/${photo._id}/chunks/${index}`);
    pieces.push(data.data);
  }
  return { ...photo, dataUrl: pieces.join('') };
}
