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

Provide the existing `MONGODB_URI`, existing `JWT_SECRET`, and a randomly generated `CUTOVER_CONTROL_TOKEN` through a permission-restricted environment file stored outside the repository. Never print these values, bake them into the image, or commit them.

Verify `GET /health` returns `storage: mongodb`, `realtime: socket.io`, `writeMode: read-only`, and `singleWriterConfigured: true`. The authenticated `POST /internal/rehydrate` reloads the current snapshot without writing Atlas. Capture snapshot `updatedAt`, counts, and a digest before and after verification to demonstrate that the document did not change.

Keep the frontend pointed at the existing Vercel backend. Do not enable writes or expose the local service publicly during standby verification.
