# PastelChat security and Admin Hub audit

Date: 2026-09-02

This was a controlled local audit using named test accounts and isolated local store state. No production user data, MongoDB collections, or push recipients were used.

## Endpoint matrix

| Area | Result | Evidence / control |
| --- | --- | --- |
| Admin dashboard and writes | Fixed | Server-side `requireAdmin`; ordinary user dashboard and release attempts return 403. |
| Admin login authority | Fixed locally; deployment prerequisite | Hardcoded master code removed. Production requires `ADMIN_LOGIN_CODE` in Render. |
| JWT/session integrity | Fixed | HS256 allowlist, issuer/audience, expiry, session record, auth version, revocation. |
| Logout / force logout / suspension | Fixed | Session revocation and auth-version invalidation; audit entries. |
| Private-space ownership | Fixed | Note, reminder, and birthday mutations require the owning user. |
| Private conversation access | Fixed | History, search, clear, send, reply, and socket private messaging require a friendship. |
| Group message IDOR | Fixed | Recall/reaction verify the message belongs to the requested group. |
| Reports and moderation | Added | Report categories/statuses, admin-only moderation, no automatic punishment, audit trail. |
| Releases and announcements | Added | Admin-only publishing, semantic-version validation, deduplicated release notifications, explicit mass/push confirmation. |
| API response minimization | Improved | Admin user views omit login codes and private message contents; OAuth errors no longer return provider details. |
| Rate limits | Added | Login/OAuth, feedback/report, friends/messages/groups/private-space/push, admin writes, and releases. |
| CORS and headers | Improved | Explicit origin allowlist, security headers, CSP, no wildcard credentialed CORS. |
| PWA privacy | Improved | Private API responses are never cached; notification URLs are restricted to same-origin app paths. |
| Client/public secret scan | Fixed / classified | Removed unused public Tenor key and source fallback; Google/VAPID public identifiers remain public by design. |
| Dependency audit | Pass at audit time | `npm audit --omit=dev`: 0 vulnerabilities. |

## Regression evidence

`backend/test/security.test.js` passes 9 controlled checks covering privilege escalation, tampered JWT, ownership enforcement, conversation access, report moderation, release idempotency, and force logout. Existing backend tests also remain green.

Remaining deployment prerequisite: configure `ADMIN_LOGIN_CODE` in Render before deploying this revision. The variable is intentionally not generated, printed, or committed by the application.
