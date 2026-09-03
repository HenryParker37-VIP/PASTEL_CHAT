const router = require('express').Router();

const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';
const GIPHY_LIMIT = 20;

router.get('/', async (req, res) => {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      message: 'GIF service is not configured. Set GIPHY_API_KEY on the server.'
    });
  }

  const query = String(req.query.q || '').trim().slice(0, 100);
  const endpoint = query ? '/search' : '/trending';
  const url = new URL(`${GIPHY_BASE}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('limit', String(GIPHY_LIMIT));
  url.searchParams.set('rating', 'pg');
  if (query) url.searchParams.set('q', query);

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      console.error(`[GIF] GIPHY returned ${response.status}`);
      if (response.status === 401 || response.status === 403) {
        return res.status(502).json({
          message: 'GIF provider rejected GIPHY_API_KEY. Update the server key.'
        });
      }
      return res.status(502).json({ message: 'GIF provider request failed.' });
    }

    const payload = await response.json();
    const data = Array.isArray(payload.data) ? payload.data : [];
    res.set('Cache-Control', query ? 'no-store' : 'public, max-age=60');
    return res.json({ data });
  } catch (error) {
    console.error('[GIF] Provider request failed:', error.message);
    return res.status(502).json({ message: 'GIF provider is unavailable.' });
  }
});

module.exports = router;
