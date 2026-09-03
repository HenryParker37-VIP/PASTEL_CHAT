const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  createNote, getUserNotes, deleteNote, updateNote, findFriendship, getFriends,
  createReminder, getUserReminders, deleteReminder,
  createBirthday, getUserBirthdays, deleteBirthday,
  getSharedPhotos, togglePhotoEncryption, deleteSharedPhoto
} = require('../db/store');

const router = express.Router();

const normalizeSharedWith = (sharedWith, ownerId) => {
  if (!Array.isArray(sharedWith)) return [];
  const recipientIds = [...new Set(sharedWith.map((recipient) => String(recipient?._id || recipient || '').trim()).filter(Boolean))]
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
  if (note.userId !== req.user._id) return res.status(403).json({ error: 'not allowed' });
  if (!deleteNote(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

router.put('/notes/:id', authMiddleware, (req, res) => {
  const { title, content, sharedWith, images } = req.body;
  const current = require('../db/store').findNote(req.params.id);
  if (!current) return res.status(404).json({ error: 'not found' });
  if (current.userId !== req.user._id) return res.status(403).json({ error: 'not allowed' });
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
  res.json(reminders);
});

router.delete('/reminders/:id', authMiddleware, (req, res) => {
  const reminder = require('../db/store').findReminder(req.params.id);
  if (!reminder) return res.status(404).json({ error: 'not found' });
  if (reminder.userId !== req.user._id) return res.status(403).json({ error: 'not allowed' });
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
  res.json(birthdays);
});

router.delete('/birthdays/:id', authMiddleware, (req, res) => {
  const birthday = require('../db/store').findBirthday(req.params.id);
  if (!birthday) return res.status(404).json({ error: 'not found' });
  if (birthday.userId !== req.user._id) return res.status(403).json({ error: 'not allowed' });
  if (!deleteBirthday(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// ===== Shared Photos =====
router.get('/shared-photos', authMiddleware, (req, res) => {
  const userId = req.user._id;
  const photos = getSharedPhotos(userId).map(photo => {
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
  res.json(photos);
});

router.delete('/shared-photos/:id', authMiddleware, (req, res) => {
  const deleted = deleteSharedPhoto(req.params.id, req.user._id);
  if (deleted === false) return res.status(403).json({ error: 'Only the owner can delete shared media' });
  if (!deleted) return res.status(404).json({ error: 'Shared media not found' });

  const recipientIds = new Set([deleted.uploadedBy._id, ...getFriends(deleted.uploadedBy._id).map((friend) => friend.friendId)]);
  const io = req.app?.get('io');
  recipientIds.forEach((recipientId) => io?.emit(`shared_media_deleted:${recipientId}`, { _id: deleted._id }));
  res.json({ ok: true, _id: deleted._id });
});

// POST /private-space/shared-photos/:id/toggle-visibility — Google users only
router.post('/shared-photos/:id/toggle-visibility', authMiddleware, (req, res) => {
  if (!req.user.isGoogleVerified) {
    return res.status(403).json({ error: 'Only Google-verified users can toggle photo visibility' });
  }
  const { isHidden } = req.body;
  const photo = togglePhotoEncryption(req.params.id, req.user._id, !!isHidden);
  if (!photo) return res.status(404).json({ error: 'Photo not found or not your photo' });
  res.json({ success: true, isHidden: photo.isHidden });
});

module.exports = router;
