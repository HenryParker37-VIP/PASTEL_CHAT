const crypto = require('crypto');
const store = require('../db/store');

const CHUNK_LENGTH = 1024 * 1024;
const MAX_CHUNKS = 12;
const UPLOAD_LIFETIME_MS = 15 * 60 * 1000;

const photoView = (photo) => {
  if (!photo) return null;
  const { dataUrl, ...view } = photo;
  return { ...view, chunkCount: view.chunkCount || Math.ceil((dataUrl || '').length / CHUNK_LENGTH) };
};

const canView = (photo, userId) => {
  const ownerId = String(photo?.uploadedBy?._id || '');
  return ownerId === String(userId) || Boolean(store.findFriendship(ownerId, userId) || store.findFriendship(userId, ownerId));
};

const recipientIds = (ownerId) => [...new Set([String(ownerId), ...(store.store.friendships || []).filter(friendship =>
  String(friendship.userId) === String(ownerId) || String(friendship.friendId) === String(ownerId)
).map(friendship => String(friendship.userId) === String(ownerId) ? String(friendship.friendId) : String(friendship.userId))])];

async function collections() {
  const db = await store.getDurableDatabase();
  if (!db) throw new Error('Durable shared media storage is unavailable');
  return {
    photos: db.collection('pastelchat_shared_photos'),
    uploads: db.collection('pastelchat_shared_photo_uploads'),
    chunks: db.collection('pastelchat_shared_photo_chunks')
  };
}

async function startUpload(user, { caption = '', expiration = 'never', mediaType = 'image', durationMs } = {}) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Shared media writes are disabled');
  if (!['image', 'video'].includes(mediaType) || store.resolveSharedMediaExpiry(expiration) === undefined) {
    const error = new Error('Invalid media settings'); error.status = 400; throw error;
  }
  if (mediaType === 'video' && (!Number.isFinite(Number(durationMs)) || Number(durationMs) < 0 || Number(durationMs) > 5000)) {
    const error = new Error('Video must be 5 seconds or shorter'); error.status = 400; throw error;
  }
  const { uploads, chunks } = await collections();
  const ownerId = String(user._id);
  const abandoned = await uploads.find({ ownerId, createdAt: { $lt: new Date(Date.now() - UPLOAD_LIFETIME_MS) } }, { projection: { _id: 1 } }).toArray();
  for (const old of abandoned) {
    await chunks.deleteMany({ ownerId, _id: { $regex: `^${old._id}:` } });
    await uploads.deleteOne({ _id: old._id, ownerId });
  }
  const id = crypto.randomUUID();
  await uploads.insertOne({ _id: id, ownerId, caption: String(caption).slice(0, 200), expiration, mediaType, durationMs: mediaType === 'video' ? Number(durationMs) : null, createdAt: new Date() });
  return { uploadId: id, chunkLength: CHUNK_LENGTH };
}

async function storeChunk(userId, uploadId, index, data) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Shared media writes are disabled');
  const { uploads, chunks } = await collections();
  const upload = await uploads.findOne({ _id: uploadId, ownerId: String(userId) });
  if (!upload || Date.now() - new Date(upload.createdAt).getTime() > UPLOAD_LIFETIME_MS) {
    const error = new Error('Upload session expired'); error.status = 404; throw error;
  }
  if (!Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS || typeof data !== 'string' || !data.length || data.length > CHUNK_LENGTH || !/^[A-Za-z0-9+/=,:;.\-]+$/.test(data)) {
    const error = new Error('Invalid media chunk'); error.status = 400; throw error;
  }
  await chunks.updateOne({ _id: `${uploadId}:${index}`, ownerId: String(userId) }, { $set: { data, createdAt: new Date() } }, { upsert: true });
}

async function finishUpload(user, uploadId, count) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Shared media writes are disabled');
  const { photos, uploads, chunks } = await collections();
  const existing = await photos.findOne({ _id: uploadId, 'uploadedBy._id': String(user._id) });
  if (existing) return photoView(existing);
  const upload = await uploads.findOne({ _id: uploadId, ownerId: String(user._id) });
  if (!upload || Date.now() - new Date(upload.createdAt).getTime() > UPLOAD_LIFETIME_MS) {
    const error = new Error('Upload session expired'); error.status = 404; throw error;
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) {
    const error = new Error('Invalid chunk count'); error.status = 400; throw error;
  }
  const pieces = await chunks.find({ ownerId: String(user._id), _id: { $in: Array.from({ length: count }, (_, i) => `${uploadId}:${i}`) } }).toArray();
  const byId = new Map(pieces.map(piece => [piece._id, piece.data]));
  if (byId.size !== count) { const error = new Error('Upload is incomplete'); error.status = 400; throw error; }
  const dataUrl = Array.from({ length: count }, (_, i) => byId.get(`${uploadId}:${i}`)).join('');
  const expected = upload.mediaType === 'video'
    ? /^data:video\/(?:webm|mp4|quicktime|ogg);base64,([A-Za-z0-9+/]+={0,2})$/i
    : /^data:image\/(?:jpeg|png|webp|gif|heic|heif);base64,([A-Za-z0-9+/]+={0,2})$/i;
  const match = dataUrl.match(expected);
  const bytes = match ? Buffer.from(match[1], 'base64').length : 0;
  const limit = upload.mediaType === 'video' ? 8 * 1024 * 1024 : 5 * 1024 * 1024;
  if (!match || !bytes || bytes > limit || dataUrl.length > MAX_CHUNKS * CHUNK_LENGTH) {
    const error = new Error('Unsupported or oversized media'); error.status = 400; throw error;
  }
  const photo = {
    _id: uploadId, dataUrl, caption: upload.caption,
    uploadedBy: { _id: String(user._id), name: user.name, avatar: user.avatar, loginMethod: user.loginMethod || 'code' },
    createdAt: new Date().toISOString(), isHidden: false, mediaType: upload.mediaType,
    chunkCount: Math.ceil(dataUrl.length / CHUNK_LENGTH),
    expiresAt: store.resolveSharedMediaExpiry(upload.expiration)
  };
  try { await photos.insertOne(photo, { writeConcern: { w: 'majority' } }); }
  catch (error) { if (error.code !== 11000) throw error; }
  await Promise.allSettled([uploads.deleteOne({ _id: uploadId, ownerId: String(user._id) }), chunks.deleteMany({ ownerId: String(user._id), _id: { $regex: `^${uploadId}:` } })]);
  return photoView(await photos.findOne({ _id: uploadId }));
}

async function listPhotos(userId) {
  const { photos } = await collections();
  const ownAndFriends = recipientIds(userId);
  const items = await photos.find({ 'uploadedBy._id': { $in: ownAndFriends }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date().toISOString() } }] }, { projection: { dataUrl: 0 } }).sort({ createdAt: -1 }).limit(50).toArray();
  return items.filter(photo => canView(photo, userId)).map(photo => (
    photo.isHidden && String(photo.uploadedBy._id) !== String(userId)
      ? { ...photo, caption: '', chunkCount: 0 }
      : photo
  ));
}

async function getPhoto(userId, photoId) {
  const { photos } = await collections();
  const photo = await photos.findOne({ _id: photoId });
  if (!photo || (photo.expiresAt && new Date(photo.expiresAt) <= new Date()) || !canView(photo, userId)) return null;
  return photo;
}

async function deletePhoto(userId, photoId) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Shared media writes are disabled');
  const { photos } = await collections();
  const existing = await photos.findOne({ _id: photoId });
  if (!existing) return null;
  if (String(existing.uploadedBy?._id) !== String(userId)) return false;
  await photos.deleteOne({ _id: photoId, 'uploadedBy._id': String(userId) });
  return photoView(existing);
}

async function toggleVisibility(userId, photoId, isHidden) {
  if (process.env.WRITE_MODE === 'read-only') throw new Error('Shared media writes are disabled');
  const { photos } = await collections();
  const result = await photos.findOneAndUpdate({ _id: photoId, 'uploadedBy._id': String(userId) }, { $set: { isHidden: !!isHidden } }, { returnDocument: 'after', projection: { dataUrl: 0 } });
  return result || null;
}

module.exports = { CHUNK_LENGTH, startUpload, storeChunk, finishUpload, listPhotos, getPhoto, deletePhoto, toggleVisibility, photoView, canView, recipientIds };
