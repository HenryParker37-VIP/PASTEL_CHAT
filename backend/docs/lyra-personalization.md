# Personal Lyra, first implementation

## Ownership and storage

The shared `aiCharacters` record defines Lyra's identity, personality, speech, and behavioral boundaries. The model router is a replaceable reasoning engine. It owns no durable personal facts.

Each memory and relationship row is scoped to `(authenticated userId, characterId)`. Routes derive `userId` from the verified session; the browser cannot choose another user's layer. Existing rows without `characterId` are treated as Lyra rows for compatibility. `messages` remains the short-term and shared-history source and is queried by the two conversation participants.

New Personal Layers persist as one small document per `(userId, characterId)` in `pastelchat_personal_layers` within the existing Atlas database. Existing `pastelchat_state` rows remain a read-only compatibility source until each user's layer is first saved; new personal changes are excluded from whole-snapshot writes. Per-user document revisions retry concurrent changes. Memory values are capped at 180 characters, each user/character retains at most 24 memories, and data URLs, image markup, and media links are refused. Image bytes remain in separate media storage. `source` distinguishes `USER_STATED` from `INFERRED`; this first version saves only explicit user statements. A newer statement for the same key replaces the old value. Selection is contextual and capped at five records. Neither the model provider nor the frontend owns the memory.

Relationship state stores interaction count, last interaction, context confidence, confirmed communication style, time zone, references to the last eight completed exchanges, and a short proactive history. It is not presented as a friendship score. Raw conversation content is not copied into relationship state.

## Generation and delivery

The latest user message and recent conversation precede relevant memory and shared character style in the prompt. Router diagnostics, recent outputs, provider health, queue, and cancellation revision use a `(userId, characterId)` key. Lyra's typing, reactions, messages, and notifications go only to sockets authenticated as that user.

The router accepts one to five natural bubbles. A single paragraph remains one bubble. On a persistent service, the backend paces and persists each bubble when delivered, checking for a newer user message before each one. The frontend displays those server-paced bubbles as they arrive. Vercel's current serverless route retains client pacing to stay within its function duration; it is not changed by this branch until deployment is reviewed.

## Proactive check-ins

The first engine uses the user's validated IANA time zone, broad morning/afternoon/evening windows, recent interaction, an explicitly stated recent event when present, a 36-hour cooldown, a two-per-week cap, and a per-window decision that often stays silent. The LLM writes the check-in; there are no fixed greeting templates. A per-user/character/local-date atomic Atlas claim in `pastelchat_proactive_claims` prevents duplicate delivery between workers. The claim collection has a TTL index and contains no personal text. Notification delivery uses the existing in-app and push interfaces.

Automatic ticks require `PERSISTENT_SERVICE=true`, `PROACTIVE_LYRA=true`, `LYRA_SINGLE_WRITER=true`, writable mode, and healthy MongoDB. They never run in Vercel serverless or read-only standby. These flags are intentionally not enabled by this change. Provider or generation failure consumes that window rather than risking duplicate messages.

## Limits before rollout

The explicit-statement extractor is intentionally conservative and currently handles a small set of English patterns plus basic Vietnamese identity and location statements. It does not infer personal facts from model output. Human and Lyra messages still use the existing monolithic snapshot, which has last-writer-wins behavior across concurrent Vercel functions; message durability under simultaneous writers needs a separate review before enabling this branch in production. Cross-process cancellation of ordinary replies also needs a durable revision if the feature is enabled on multiple serverless workers. The persistent single-writer path has sequential delivery, subject to live verification before deployment.
