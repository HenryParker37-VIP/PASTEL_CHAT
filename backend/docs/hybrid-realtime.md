# Optional Render realtime relay

Vercel remains the sole production REST/API writer. Render Free is an optional
Socket.IO transport and may sleep. The browser sends messages, Lyra turns,
reactions, and delivery/read receipts through Vercel REST. It polls Vercel every
1.5 seconds while the relay is unavailable and reconciles from Vercel on socket
reconnect. When the relay is connected, a 15-second reconciliation interval
remains to recover missed change-stream events. Existing message IDs and
`clientMessageId` values are merged so socket delivery and REST history do not
duplicate a bubble.

Render reads Atlas `pastelchat_messages` and `pastelchat_state` change streams,
then emits only to authenticated user rooms. Typing and WebRTC signaling are
transient socket-only events. They cannot be guaranteed while Render sleeps.
The relay does not send push notifications or perform durable mutations.
Vercel handles all application writes. Atlas must grant the Render credential
read-only rights, including change-stream reads. At startup the relay inspects
its Atlas privileges and refuses to serve if the credential has write actions.
The relay also fails to start if `WRITE_MODE` is not `read-only` or
`MONGODB_URI` is absent.

Render service configuration:

- Dockerfile: `backend/Dockerfile`, build context: repository root.
- One Free Web Service instance. Free sleep is expected; do not add keep-alive traffic.
- `REALTIME_RELAY=true`, `WRITE_MODE=read-only`, `PERSISTENT_SERVICE=true`.
- `TELEGRAM_POLLING=false`, `PROACTIVE_LYRA=false`.
- `CORS_ALLOWED_ORIGINS=https://pastel-chat.vercel.app`, health check `/health`.
- Existing dedicated Atlas read-only URI with database `pastelchat`.
- Authentication configuration must match production. Production currently uses
  the built-in JWT fallback when `JWT_SECRET` is unset; do not invent a value.
- `/internal/*` is blocked by the relay HTTP guard. Rehydration occurs from
  Atlas at startup and during authenticated socket handshakes.

The frontend is **not enabled** by deploying Render. After the Vercel REST
version containing the group receipt route is deployed and independently
reviewed, an explicit `REACT_APP_REALTIME_RELAY_URL` may be set to Render's
HTTPS origin in a controlled frontend deployment. Leave `REACT_APP_BACKEND_URL`
pointing at Vercel. No Render URL belongs in the REST setting.

Outage verification: disconnect Render, send through Vercel REST, receive via
Vercel polling, reconnect Render, and compare conversation message IDs before
and after reconciliation. A grey "Updates via sync" indicator is expected when
the relay sleeps; the client network warning uses a separate Vercel edge probe.
