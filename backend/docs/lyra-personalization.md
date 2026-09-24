# Personal Lyra, first implementation

## Ownership and storage

The shared `aiCharacters` record defines Lyra's identity, personality, speech, and behavioral boundaries. The model router is a replaceable reasoning engine. It owns no durable personal facts.

Each memory and relationship row is scoped to `(authenticated userId, characterId)`. Routes derive `userId` from the verified session; the browser cannot choose another user's layer. Existing rows without `characterId` are treated as Lyra rows for compatibility. `messages` remains the short-term and shared-history source and is queried by the two conversation participants.

New Personal Layers persist as one small document per `(userId, characterId)` in `pastelchat_personal_layers` within the existing Atlas database. Existing `pastelchat_state` rows remain a read-only compatibility source until each user's layer is first saved; new personal changes are excluded from whole-snapshot writes. Per-user document revisions retry concurrent changes. Memory values are capped at 180 characters, each user/character retains at most 24 memories, and data URLs, image markup, and media links are refused. Image bytes remain in separate media storage. `source` distinguishes `USER_STATED` from `INFERRED`; this first version saves only explicit user statements. A newer statement for the same key replaces the old value. Selection is contextual and capped at five records. Neither the model provider nor the frontend owns the memory.

## Message durability and turn ordering

New messages are individually upserted by immutable message ID in `pastelchat_messages` with majority write concern. Later changes to one message update only that document. A cleared conversation creates tombstones so old snapshot rows cannot reappear. The existing `pastelchat_state.data.messages` array is a legacy read fallback; new code never adds new messages to that array. Each request overlays the individual message records after snapshot hydration, independent of the snapshot's 1.5-second refresh throttle. During a mixed-version deployment, older code can still write only the snapshot; a coordinated rollout and post-rollout reconciliation are required before calling migration complete. The new code cannot recover a message already lost by the old code before it was observed.

The browser sends the exact returned message ID to `/messages/ai-reply`. The backend fetches that ID from durable storage and rejects a missing, foreign, or superseded turn. `pastelchat_ai_turns` assigns a monotonic sequence per `(userId, characterId)` at user-message creation, then atomically advances the current turn only for a higher sequence. This handles same-millisecond sends and a delayed older worker. Before each bubble, a MongoDB transaction updates that turn document and inserts the bubble document together. A concurrent newer turn conflicts or causes the old turn check to fail, so an obsolete bubble is not committed or emitted. The turn document contains IDs, sequence numbers, and timestamps, not prompt or message text.

Long-term memory extraction reads the current incoming user message only. It checks sentence punctuation, first-person clause position, questions, negation, and uncertainty before accepting an explicit statement. Deleting a memory therefore does not re-create it from old conversation context. Recent conversation still informs responses without becoming durable memory.

Relationship state stores interaction count, last interaction, context confidence, confirmed communication style, time zone, references to the last eight completed exchanges, and a short proactive history. It is not presented as a friendship score. Raw conversation content is not copied into relationship state.

## Generation and delivery

The latest user message and recent conversation precede relevant memory and shared character style in the prompt. Router diagnostics, recent outputs, provider health, queue, and cancellation revision use a `(userId, characterId)` key. Atlas turn state enforces cross-process supersession. Lyra's typing, reactions, messages, and notifications go only to sockets authenticated as that user.

The router accepts one to five natural bubbles. A single paragraph remains one bubble. On a persistent service, the backend paces and persists each bubble when delivered, checking for a newer user message before each one. The frontend displays those server-paced bubbles as they arrive. Vercel's current serverless route retains client pacing to stay within its function duration; it is not changed by this branch until deployment is reviewed.

## Proactive check-ins

The first engine uses the user's validated IANA time zone, broad morning/afternoon/evening windows, recent interaction, an explicitly stated recent event when present, a 36-hour cooldown, a two-per-week cap, and a per-window decision that often stays silent. The LLM writes the check-in; there are no fixed greeting templates. A per-user/character/local-date atomic Atlas claim in `pastelchat_proactive_claims` prevents duplicate delivery between workers. The claim collection has a TTL index and contains no personal text. Notification delivery uses the existing in-app and push interfaces.

Automatic ticks require `PERSISTENT_SERVICE=true`, `PROACTIVE_LYRA=true`, `LYRA_SINGLE_WRITER=true`, writable mode, and healthy MongoDB. They never run in Vercel serverless or read-only standby. These flags are intentionally not enabled by this change. Provider or generation failure consumes that window rather than risking duplicate messages.

## Limits before rollout

The explicit-statement extractor is intentionally conservative and currently handles a small set of English patterns plus basic Vietnamese identity and location statements. It does not infer personal facts from model output. Other application state still uses the monolithic snapshot and can have last-writer-wins conflicts between Vercel workers; this needs a separate review. The message overlay currently reads all individual message documents per request and needs pagination/indexing as volume grows. The local concurrency integration test uses a disposable MongoDB replica set and three actual worker processes (`PASTELCHAT_TEST_MONGO_URI=... npm --prefix backend run test:concurrency`). Production Atlas permissions, transaction behavior, and the mixed-version rollout have not been verified. Vercel keeps client-paced display; full server-paced delivery remains a persistent-service behavior. No deployment or cutover is authorized by this branch.
