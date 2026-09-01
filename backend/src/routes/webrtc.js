const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const publicIceServers = [
  { urls: ['stun:stun.cloudflare.com:3478'] },
];

let cachedCloudflare = null;

async function cloudflareIceServers() {
  const tokenId = process.env.CLOUDFLARE_TURN_TOKEN_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!tokenId || !apiToken) return null;
  if (cachedCloudflare && cachedCloudflare.expiresAt > Date.now()) return cachedCloudflare.iceServers;

  const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${tokenId}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: Number(process.env.TURN_CREDENTIAL_TTL || 86400) }),
  });
  const body = await response.json();
  if (!response.ok || !Array.isArray(body.iceServers)) {
    throw new Error(`Cloudflare TURN credential request failed (${response.status})`);
  }
  cachedCloudflare = { iceServers: body.iceServers, expiresAt: Date.now() + 5 * 60 * 1000 };
  return body.iceServers;
}

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
  cloudflareIceServers().then((dynamicServers) => {
    const turn = dynamicServers || configuredTurnServers();
    if (!turn.length) {
      return res.status(503).json({ error: 'TURN is not configured on the production backend', code: 'TURN_NOT_CONFIGURED' });
    }
    // Credentials are delivered only to an authenticated caller at runtime;
    // the Cloudflare API token remains server-side and is never compiled into
    // the frontend bundle or committed to git.
    return res.json({ iceServers: [...publicIceServers, ...turn] });
  }).catch((err) => {
    console.error('[WebRTC] Cloudflare TURN credentials unavailable:', err.message);
    return res.status(503).json({ error: 'TURN credentials unavailable', code: 'TURN_UNAVAILABLE' });
  });
});

module.exports = router;
