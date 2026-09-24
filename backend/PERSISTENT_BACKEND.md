# Persistent backend safety

## Single-writer contract

- The monolithic Atlas snapshot supports exactly one persistent backend instance. Set `PERSISTENT_INSTANCE_COUNT=1` and verify the actual runtime has one instance.
- Any future writable deployment must also set `SINGLE_WRITER_DEPLOYMENT_POLICY=no-overlap` and configure the provider so old and new writers cannot overlap. Startup refuses writable persistent mode without both safeguards.
- Keep standby instances read-only with `WRITE_MODE=read-only`. Read-only persistence paths suppress Atlas writes, including snapshot flushes.
- Persistent mode requires the existing Atlas snapshot and refuses to seed, repair, or reset production data. Do not change the database or collection during standby verification.

## Local Docker standby

Build from the backend context with the repository's `backend/Dockerfile`. Run exactly one container, publish port 5001, and set:

```text
PERSISTENT_SERVICE=true
PERSISTENT_INSTANCE_COUNT=1
WRITE_MODE=read-only
TELEGRAM_POLLING=false
CORS_ALLOWED_ORIGINS=https://pastel-chat.vercel.app
ALLOW_VERCEL_PREVIEW_ORIGINS=false
```

Provide the existing read-only `MONGODB_URI` and a randomly generated `CUTOVER_CONTROL_TOKEN` through a permission-restricted environment file stored outside the repository. Leave `JWT_SECRET` unset to match current Vercel Production behavior, which uses the fallback in `src/config/auth.js`. Never print the token or URI, bake them into the image, or commit them. The Docker image runs as the unprivileged `node` user; preserve the read-only root filesystem and restricted `/tmp` tmpfs when running it.

Verify `GET /health` returns `storage: mongodb`, `realtime: socket.io`, `writeMode: read-only`, and `singleWriterConfigured: true`. The authenticated `POST /internal/rehydrate` reloads the current snapshot without writing Atlas. Capture snapshot `updatedAt`, counts, and a digest before and after verification to demonstrate that the document did not change.

Keep the frontend pointed at the existing Vercel backend. Do not enable writes or expose the local service publicly during standby verification.

## Cloudflare Tunnel boundary

- Keep the browser CORS origin set to `https://pastel-chat.vercel.app`. The tunnel hostname is a backend destination, not a browser origin; add an origin only if a browser frontend is actually served from it.
- The application returns 404 for `/internal/*` requests carrying Cloudflare edge headers (`CF-Connecting-IP` or `CF-Ray`). Direct local authenticated `/internal/rehydrate` requests without those headers remain available for standby checks.
- Add a Cloudflare WAF Custom Rule with action **Block** for `http.request.uri.path eq "/internal" or starts_with(http.request.uri.path, "/internal/")` before enabling any tunnel. This edge rule is required defense in depth; never expose the cutover control endpoint through a public tunnel.
