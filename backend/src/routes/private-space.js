const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  createNote, getUserNotes, deleteNote, updateNote,
  createReminder, getUserReminders, deleteReminder,
  createBirthday, getUserBirthdays, deleteBirthday,
  getSharedPhotos, togglePhotoEncryption
} = require('../db/store');

const router = express.Router();

// ===== Notes =====
router.post('/notes', authMiddleware, (req, res) => {
  const { title, content, sharedWith } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  const note = createNote(req.user._id, { title, content, sharedWith: sharedWith || [] });
  res.json(note);
});

router.get('/notes', authMiddleware, (req, res) => {
  const notes = getUserNotes(req.user._id);
  res.json(notes);
});

router.delete('/notes/:id', authMiddleware, (req, res) => {
  if (!deleteNote(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

router.put('/notes/:id', authMiddleware, (req, res) => {
  const { title, content, sharedWith } = req.body;
  const updates = {};
  if (title) updates.title = title;
  if (content) updates.content = content;
  if (sharedWith) updates.sharedWith = sharedWith;
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
  if (!deleteBirthday(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// ===== Shared Photos =====
router.get('/shared-photos', authMiddleware, (req, res) => {
  const userId = req.user._id;
  const photos = getSharedPhotos().map(photo => {
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
