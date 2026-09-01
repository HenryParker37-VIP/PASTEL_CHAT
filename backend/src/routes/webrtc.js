const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const publicIceServers = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

function configuredTurnServers() {
  const urls = (process.env.TURN_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;
  if (!urls.length || !username || !credential) return [];
  return [{ urls, username, credential }];
}

router.get('/ice-servers', auth, (req, res) => {
  const turn = configuredTurnServers();
  if (!turn.length) {
    return res.status(503).json({
      error: 'TURN is not configured on the production backend',
      code: 'TURN_NOT_CONFIGURED',
    });
  }
  // The credential is delivered only to an authenticated caller at runtime;
  // it is never compiled into the frontend bundle or committed to git.
  return res.json({ iceServers: [...publicIceServers, ...turn] });
});

module.exports = router;
