/**
 * Cloudflare adds these headers to requests that pass through its edge.
 * Internal cutover endpoints remain available to direct local requests, but
 * are hidden from requests arriving through a public Cloudflare Tunnel.
 */
function blockCloudflareInternalRequests(req, res, next) {
  if (req.get('cf-connecting-ip') || req.get('cf-ray')) {
    return res.status(404).json({ message: 'Not found' });
  }
  return next();
}

module.exports = { blockCloudflareInternalRequests };
