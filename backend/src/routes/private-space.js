const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createNote, getUserNotes, deleteNote, updateNote,
  createReminder, getUserReminders, deleteReminder,
  createBirthday, getUserBirthdays, deleteBirthday
} = require('../db/store');

const router = express.Router();

// ===== Notes =====
router.post('/notes', requireAuth, (req, res) => {
  const { title, content, sharedWith } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });
  const note = createNote(req.user._id, { title, content, sharedWith: sharedWith || [] });
  res.json(note);
});

router.get('/notes', requireAuth, (req, res) => {
  const notes = getUserNotes(req.user._id);
  res.json(notes);
});

router.delete('/notes/:id', requireAuth, (req, res) => {
  if (!deleteNote(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

router.put('/notes/:id', requireAuth, (req, res) => {
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
router.post('/reminders', requireAuth, (req, res) => {
  const { date, time, text } = req.body;
  if (!date || !time || !text) return res.status(400).json({ error: 'date, time, text required' });
  const reminder = createReminder(req.user._id, { date, time, text });
  res.json(reminder);
});

router.get('/reminders', requireAuth, (req, res) => {
  const reminders = getUserReminders(req.user._id);
  res.json(reminders);
});

router.delete('/reminders/:id', requireAuth, (req, res) => {
  if (!deleteReminder(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// ===== Birthdays =====
router.post('/birthdays', requireAuth, (req, res) => {
  const { friendId, friendName, date } = req.body;
  if (!friendId || !friendName || !date) return res.status(400).json({ error: 'friendId, friendName, date required' });
  const birthday = createBirthday(req.user._id, { friendId, friendName, date });
  res.json(birthday);
});

router.get('/birthdays', requireAuth, (req, res) => {
  const birthdays = getUserBirthdays(req.user._id);
  res.json(birthdays);
});

router.delete('/birthdays/:id', requireAuth, (req, res) => {
  if (!deleteBirthday(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

module.exports = router;
