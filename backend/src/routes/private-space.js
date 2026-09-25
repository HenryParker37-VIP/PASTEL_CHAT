const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  createNote, getUserNotes, deleteNote, updateNote, findFriendship, getFriends,
  createReminder, getUserReminders, deleteReminder,
  createBirthday, getUserBirthdays, deleteBirthday,
  getSharedPhotos, togglePhotoEncryption, deleteSharedPhoto
} = require('../db/store');

const router = express.Router();
const { emitToUser } = require('../services/userSocket');
const sharedMedia = require('../services/sharedPhotoMedia');
const storeDb = require('../db/store');

const mediaError = (res, error) => res.status(error.status || 503).json({ error: error.status ? error.message : 'Shared media storage is temporarily unavailable' });

const normalizeSharedWith = (sharedWith, ownerId) => {
  if (!Array.isArray(sharedWith)) return [];
  const recipientIds = [...new Set(sharedWith.map((recipient) => {
    const id = recipient && typeof recipient === 'object'
      ? (recipient._id || recipient.id || recipient.userId)
      : recipient;
    return String(id || '').trim();
  }).filter(Boolean))]
    .filter((recipientId) => recipientId !== String(ownerId));
  if (recipientIds.some((recipientId) => !findFriendship(ownerId, recipientId))) {
    const error = new Error('Notes can only be shared with current friends');
    error.status = 403;
    throw error;
  }
  return recipientIds;
};

// ===== Notes =====
router.post('/notes', authMiddleware, (req, res) => {
  const { title, content, sharedWith, images } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  try {
    const note = createNote(req.user._id, { title, content, sharedWith: normalizeSharedWith(sharedWith, req.user._id), images: images || [] });
    res.json(note);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || 'Could not share note' });
  }
});

router.get('/notes', authMiddleware, (req, res) => {
  const notes = getUserNotes(req.user._id);
  res.json(notes);
});

router.delete('/notes/:id', authMiddleware, (req, res) => {
  const note = require('../db/store').findNote(req.params.id);
  if (!note) return res.status(404).json({ error: 'not found' });
  if (String(note.userId) !== String(req.user._id)) return res.status(403).json({ error: 'not allowed' });
  if (!deleteNote(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

router.put('/notes/:id', authMiddleware, (req, res) => {
  const { title, content, sharedWith, images } = req.body;
  const current = require('../db/store').findNote(req.params.id);
  if (!current) return res.status(404).json({ error: 'not found' });
  if (String(current.userId) !== String(req.user._id)) return res.status(403).json({ error: 'not allowed' });
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (sharedWith !== undefined) {
    try {
      updates.sharedWith = normalizeSharedWith(sharedWith, req.user._id);
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Could not share note' });
    }
  }
  if (images !== undefined) updates.images = images;
  const note = updateNote(req.params.id, updates);
  if (!note) return res.status(404).json({ error: 'not found' });
  res.json(note);
});

// ===== Reminders =====
router.post('/reminders', authMiddleware, (req, res) => {
  const { date, time, text } = req.body;
  if (!date || !time || !text) return res.status(400).json({ error: 'date, time, text required' });
  const reminder = createReminder(req.user._id, { date, time, text });
  res.json(reminder);
});

router.get('/reminders', authMiddleware, (req, res) => {
  const reminders = getUserReminders(req.user._id);
  res.json(reminders || []);
});

router.delete('/reminders/:id', authMiddleware, (req, res) => {
  const reminder = require('../db/store').findReminder(req.params.id);
  if (!reminder) return res.status(404).json({ error: 'not found' });
  if (String(reminder.userId) !== String(req.user._id)) return res.status(403).json({ error: 'not allowed' });
  if (!deleteReminder(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// ===== Birthdays =====
router.post('/birthdays', authMiddleware, (req, res) => {
  const { friendId, friendName, date } = req.body;
  if (!friendId || !friendName || !date) return res.status(400).json({ error: 'friendId, friendName, date required' });
  const birthday = createBirthday(req.user._id, { friendId, friendName, date });
  res.json(birthday);
});

router.get('/birthdays', authMiddleware, (req, res) => {
  const birthdays = getUserBirthdays(req.user._id);
  res.json(birthdays || []);
});

router.delete('/birthdays/:id', authMiddleware, (req, res) => {
  const birthday = require('../db/store').findBirthday(req.params.id);
  if (!birthday) return res.status(404).json({ error: 'not found' });
  if (String(birthday.userId) !== String(req.user._id)) return res.status(403).json({ error: 'not allowed' });
  if (!deleteBirthday(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// ===== Shared Photos =====
router.get('/shared-photos', authMiddleware, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const userId = req.user._id;
  const legacyPhotos = getSharedPhotos(userId).map(photo => {
    if (photo.isHidden && photo.uploadedBy._id !== userId) {
      return {
        _id: photo._id,
        dataUrl: null,
        caption: '',
        uploadedBy: photo.uploadedBy,
        createdAt: photo.createdAt,
        isHidden: true,
      };
    }
    return photo;
  });
  if (!storeDb.isDurableStorageEnabled()) return res.json(legacyPhotos);
  try {
    const photos = await sharedMedia.listPhotos(userId);
    res.json([...photos, ...legacyPhotos].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50));
  } catch (error) { mediaError(res, error); }
});

// Vercel's request limit is 4.5 MB. Each authenticated upload request stays
// below that limit; only the final media document holds the complete payload.
router.post('/shared-photos/uploads', authMiddleware, async (req, res) => {
  try { res.status(201).json(await sharedMedia.startUpload(req.user, req.body || {})); }
  catch (error) { mediaError(res, error); }
});

router.put('/shared-photos/uploads/:id/chunks/:index', authMiddleware, async (req, res) => {
  try {
    await sharedMedia.storeChunk(req.user._id, req.params.id, Number(req.params.index), req.body?.data);
    res.json({ ok: true });
  } catch (error) { mediaError(res, error); }
});

router.post('/shared-photos/uploads/:id/complete', authMiddleware, async (req, res) => {
  try {
    const photo = await sharedMedia.finishUpload(req.user, req.params.id, Number(req.body?.chunkCount));
    const recipients = sharedMedia.recipientIds(req.user._id);
    const io = req.app?.get('io');
    for (const recipientId of recipients) emitToUser(io, recipientId, `new_photo_shared:${recipientId}`, photo);
    res.status(201).json({ ok: true, photo });
  } catch (error) { mediaError(res, error); }
});

router.get('/shared-photos/:id/chunks/:index', authMiddleware, async (req, res) => {
  try {
    const photo = await sharedMedia.getPhoto(req.user._id, req.params.id);
    if (!photo) return res.status(404).json({ error: 'Shared media not found' });
    if (photo.isHidden && String(photo.uploadedBy._id) !== String(req.user._id)) return res.status(403).json({ error: 'Shared media is hidden' });
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= photo.chunkCount) return res.status(404).json({ error: 'Media chunk not found' });
    res.set('Cache-Control', 'private, no-store');
    res.json({ data: photo.dataUrl.slice(index * sharedMedia.CHUNK_LENGTH, (index + 1) * sharedMedia.CHUNK_LENGTH) });
  } catch (error) { mediaError(res, error); }
});

router.delete('/shared-photos/:id', authMiddleware, async (req, res) => {
  if (storeDb.isDurableStorageEnabled()) {
    try {
      const deleted = await sharedMedia.deletePhoto(req.user._id, req.params.id);
      if (deleted === false) return res.status(403).json({ error: 'Only the owner can delete shared media' });
      if (deleted) {
        const recipientIds = sharedMedia.recipientIds(deleted.uploadedBy._id);
        const io = req.app?.get('io');
        recipientIds.forEach(recipientId => emitToUser(io, recipientId, `shared_media_deleted:${recipientId}`, { _id: deleted._id }));
        return res.json({ ok: true, _id: deleted._id });
      }
    } catch (error) { return mediaError(res, error); }
  }
  const deleted = deleteSharedPhoto(req.params.id, req.user._id);
  if (deleted === false) return res.status(403).json({ error: 'Only the owner can delete shared media' });
  if (!deleted) return res.status(404).json({ error: 'Shared media not found' });

  const recipientIds = new Set([deleted.uploadedBy._id, ...getFriends(deleted.uploadedBy._id).map((friend) => friend.friendId)]);
  const io = req.app?.get('io');
  recipientIds.forEach((recipientId) => emitToUser(io, recipientId, `shared_media_deleted:${recipientId}`, { _id: deleted._id }));
  res.json({ ok: true, _id: deleted._id });
});

// POST /private-space/shared-photos/:id/toggle-visibility — Google users only
router.post('/shared-photos/:id/toggle-visibility', authMiddleware, async (req, res) => {
  if (!req.user.isGoogleVerified) {
    return res.status(403).json({ error: 'Only Google-verified users can toggle photo visibility' });
  }
  const { isHidden } = req.body;
  if (storeDb.isDurableStorageEnabled()) {
    try {
      const photo = await sharedMedia.toggleVisibility(req.user._id, req.params.id, isHidden);
      if (photo) return res.json({ success: true, isHidden: photo.isHidden });
    } catch (error) { return mediaError(res, error); }
  }
  const photo = togglePhotoEncryption(req.params.id, req.user._id, !!isHidden);
  if (!photo) return res.status(404).json({ error: 'Photo not found or not your photo' });
  res.json({ success: true, isHidden: photo.isHidden });
});

module.exports = router;
