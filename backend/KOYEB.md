# Koyeb single-writer cutover runbook

## Service contract

- Use `backend/Dockerfile` with `backend` as the build context; serve port `5001`; readiness check `GET /health`.
- Configure fixed/manual scaling to exactly **1 instance**. Disable autoscaling and scale-to-zero. `KOYEB_INSTANCE_COUNT=1` is also required by the writable-mode startup guard; confirm the actual Koyeb service scaling panel remains fixed at one.
- The monolithic snapshot allows exactly one writable backend instance across deployments. Koyeb normally keeps the current Deployment running until the replacement is healthy, then stops it. Therefore, while `WRITE_MODE=enabled`, configure and verify Koyeb's deployment strategy as **immediate** (`KOYEB_DEPLOYMENT_STRATEGY=immediate`); the process refuses writable startup without this declaration. This can cause downtime during replacement. Disable automatic deployments while writable; freeze the current writer before any rollout and rehydrate from Atlas before resuming.
- Connect only to the existing Atlas database and the existing `pastelchat_state` document. Startup fails closed if the snapshot is missing/invalid or above the safe size threshold. It never seeds, repairs, or resets Atlas in persistent-service mode.
- Set `PERSISTENT_SERVICE=true`, `KOYEB_INSTANCE_COUNT=1`, the exact existing `MONGODB_URI` and `JWT_SECRET`, and `CORS_ALLOWED_ORIGINS` only to exact approved Pastel Chat Vercel origins. `https://pastel-chat.vercel.app` is always allowed. Any preview origin must be listed individually; wildcard Vercel origins are rejected.
- Leave `TELEGRAM_POLLING` unset/false unless Koyeb is deliberately assigned that poller.
- Initial deployment is read-only by default. Keep `WRITE_MODE` unset (or any value other than `enabled`) and leave `CUTOVER_CONTROL_TOKEN` in Koyeb's secret environment; never place it in frontend code or logs.

## Zero-write verification

In read-only mode, authenticated requests require an existing user and session, session last-used timestamps are not touched, REST mutation methods return 503, and authenticated sockets join their user room but register no mutation handlers. `GET /health` reports Atlas readiness and `writeMode: read-only`. Use this mode to verify service health and Atlas connectivity before cutover.

Immediately before cutover, while Koyeb is still read-only, call `POST /internal/rehydrate` with `Authorization: Bearer <CUTOVER_CONTROL_TOKEN>`. It reloads the latest valid Atlas snapshot into memory without writing Atlas. The endpoint is unavailable unless the persistent service is read-only and requires the secret token. Do this only after the Vercel write freeze below has taken effect and in-flight Vercel requests have drained.

## Required cutover order

1. Review and approve the exact Vercel write-freeze release. Set `APPLICATION_WRITES_DISABLED=true` for the Vercel API and deploy that code. Confirm write methods return 503 and allow in-flight serverless requests to finish. The freeze handler bypasses Vercel snapshot hydrate/flush on later requests.
2. Verify Koyeb `/health` returns 200 with `storage: mongodb`, `writeMode: read-only`, and one fixed instance. Confirm the actual Koyeb panel shows one instance with autoscaling and scale-to-zero disabled.
3. Call the authenticated rehydration endpoint; retain its `users`, `messages`, and `updatedAt` result as the pre-cutover snapshot evidence.
4. Prepare a single Vercel frontend release with `REACT_APP_BACKEND_URL` and `REACT_APP_SIGNALING_URL` set to the same Koyeb origin. Frontend startup disables both REST and sockets if their effective origins differ. Do not deploy it before step 1 is complete.
5. Set `KOYEB_DEPLOYMENT_STRATEGY=immediate`, verify the Koyeb service is actually configured for immediate replacement and fixed one-instance scaling, then enable Koyeb writes with `WRITE_MODE=enabled` and `KOYEB_INSTANCE_COUNT=1`; verify health, then deploy the paired frontend endpoint change. Vercel's API write freeze remains enabled, so only Koyeb can write.

## Rollback order

Freeze Koyeb first (`WRITE_MODE=read-only`) and wait for its shutdown/write work to settle. Rehydrate the Vercel backend from Atlas using its normal store hydration, then remove `APPLICATION_WRITES_DISABLED` and deploy the frontend endpoints together back to Vercel. Do not allow both services to be writable during rollback. Keep the Koyeb write freeze in place until the Vercel endpoint is confirmed. Before later writable Koyeb deployments, freeze writes, deploy with the verified immediate strategy, rehydrate from Atlas, and explicitly re-enable writes.

This repository change does not deploy either service or perform any production cutover. The current snapshot store is safe only with one writable backend instance. Any future scaling change requires a concurrency-safe persistence migration first.
