# Koyeb persistent backend preparation

This service runs the existing Express API and Socket.IO server as one persistent Node process. It uses the existing Atlas `pastelchat_state` collection and the existing token format. It does not provision, seed, or reset a database.

## Service configuration

- Set the service root/build context to `backend` and use its `Dockerfile`.
- Expose HTTP port `5001` (Koyeb injects `PORT`; the app honors it).
- Health check: `GET /health`.
- Set `PERSISTENT_SERVICE=true` so startup requires `MONGODB_URI` and `/health` stays unready until Atlas connects.
- Set `MONGODB_URI` to the existing production Atlas URI and `JWT_SECRET` to the exact existing production signing secret. Do not rotate either value as part of this migration.
- Set `CORS_ALLOWED_ORIGINS` to the exact production frontend origin(s), comma separated, and `ALLOW_VERCEL_PREVIEW_ORIGINS=false`.
- Keep `TELEGRAM_POLLING` unset/false unless Telegram polling is intentionally assigned to this service.
- Keep one Koyeb instance while the current snapshot store is in use.

## Migration safety gate

Do not send production users to this service or run it as a writable peer beside Vercel yet. Both deployments currently hydrate and write the entire `pastelchat_state` document. Concurrent writes can overwrite each other's users, messages, or other state. The existing Vercel backend must remain untouched until persistence is changed to concurrency-safe per-record operations or a controlled single-writer cutover has been reviewed.

The Vercel frontend already accepts `REACT_APP_BACKEND_URL` and uses it for both HTTP and Socket.IO (`REACT_APP_SIGNALING_URL` can override the socket target). Leave both unset in production until the new backend is independently reviewed. On a later frontend release, configure the REST base and signaling origin to the Koyeb service together; reconnect currently fetches message history and the existing polling loop remains available as recovery.

No live Koyeb deployment has been performed by this preparation change.
