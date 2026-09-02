const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getReleases,
  findRelease,
  markReleaseSeen,
  hasSeenRelease
} = require('../db/store');

// Release notes are safe to read before login so the app update notice can
// describe a pending release without blocking the authentication screen.
router.get('/latest', (req, res) => {
  const release = getReleases()[0] || null;
  res.json({ release });
});

router.get('/', auth, (req, res) => {
  res.json({ releases: getReleases() });
});

router.get('/:version', auth, (req, res) => {
  const release = findRelease(req.params.version);
  if (!release) return res.status(404).json({ message: 'Release not found' });
  res.json({ release, seen: hasSeenRelease(req.user._id, release.version) });
});

router.post('/:version/seen', auth, (req, res) => {
  const release = markReleaseSeen(req.user._id, req.params.version);
  if (!release) return res.status(404).json({ message: 'Release not found' });
  res.json({ ok: true, release });
});

module.exports = router;
