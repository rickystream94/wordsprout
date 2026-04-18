# Research: WordSprout MVP — 001-phrasebook-pwa-mvp

**Phase**: 0 — Technical Research
**Date**: 2026-04-12
**Purpose**: Resolve all NEEDS CLARIFICATION items from Technical Context and confirm
best-practice choices for the key architectural decisions before design begins.

---

## R-01: Offline Full-Text Search (IndexedDB, browser-only, 2,000+ entries)

**Decision**: MiniSearch
**Rationale**: MiniSearch is the recommended library for offline full-text search in this
app. At 2,000 entries the in-memory index rebuild time is ~30–50ms on first load — fast
enough to be imperceptible. Its API is simple and well-documented, it handles multi-field
indexing (source, target, notes, tags) natively, supports fuzzy matching, and produces
relevance-ranked results. The bundle addition is ~9 KB gzipped. Index is kept in memory
during a session; no persistence layer is needed for MVP as rebuild is fast.
**Alternatives considered**:
- *FlexSearch*: Significantly faster for very large corpora and supports IndexedDB index
  persistence. Configuration is more complex and the multi-language tokenizer tuning is
  non-trivial. Not justified for 2,000 items where MiniSearch query latency is already
  sub-millisecond. Revisit if entry count exceeds 20,000 or performance regresses.
- *Fuse.js*: Smallest bundle (~6.5 KB) but uses a Bitap fuzzy-match algorithm with no
  structured tokenization. Does not produce natural relevance scoring across multi-field
  documents. Not suitable for a search-heavy vocabulary tool.

---

## R-02: Offline Sync Strategy (iOS + Android PWA)

**Decision**: Online-event replay-queue pattern
**Rationale**: The Web Background Sync API is supported in Chrome/Edge/Android but is
**not supported in Safari/iOS** (as of April 2026, no roadmap indication of change).
Since WordSprout targets both iOS and Android PWA as a first-class requirement, Background
Sync cannot be the primary mechanism. The recommended pattern is:

1. All mutations (create/update/delete) are written to IndexedDB first (optimistic local
   write).
2. A `pendingSync` queue in IndexedDB stores operations not yet confirmed by the server.
3. On `window.online` event (and on app foreground via `visibilitychange`), the client
   replays the pending queue against the API in chronological order.
4. Successfully replayed operations are removed from the queue; failed operations increment
   a retry counter (max 3 retries before surfacing an error to the user).
5. Conflict resolution is last-write-wins (the server timestamp wins on conflict). Per
   the spec assumption, multi-device concurrent editing is not a supported MVP use case.

This pattern works identically on all platforms without relying on any native OS API.
**Alternatives considered**:
- *Background Sync API with iOS fallback*: The fallback complexity negates the benefit;
  using the `online` event uniformly is simpler and equally reliable for this use case.
- *WebSocket / long-poll sync*: Overkill for a personal vocabulary app with 50 users;
  adds always-on infrastructure cost in violation of Principle V.

---

## R-03: Azure Cosmos DB — Container Strategy

**Decision**: Single container, partition key `/userId`, type discriminator field
**Rationale**: For ~50 users and ~100,000 total documents at launch, a single container
with `/userId` as the partition key places all of a given user's data in one logical
partition. This makes all user-scoped reads efficient point-reads or single-partition
queries. ACID transactions (if needed for consistency) span only one container. Serverless
billing avoids the per-container overhead of provisioned throughput. No cross-partition
fan-out is needed for any query in the MVP.

Document schema uses a `type` discriminator: `"phrasebook"`, `"vocabulary_entry"`,
`"ai_enrichment"`, `"access_request"`. All documents include `id` (UUID), `userId`,
`type`, and `createdAt` fields. Entity-specific fields follow.
**Alternatives considered**:
- *Separate containers per entity type*: Better independent scaling and retention policies,
  but adds multiple minimum-cost units and requires application-level joins. Not justified
  at this scale.

---

## R-04: Azure Cosmos DB Serverless — Cost Estimate (Private Preview)

**Decision**: Serverless Cosmos DB is safe and cost-effective for private preview
**Calculation**:
- 50 users × 10 writes/day × 30 days = 15,000 write RUs/month (~1 RU each = 15,000 RUs)
- 50 users × 50 reads/day × 30 days = 75,000 read RUs/month (~1 RU each = 75,000 RUs)
- Filtered queries (search fallback, if any): ~10,000 RUs/month at 2–5 RU each
- **Total**: ~110,000 RUs/month → (0.11 / 1,000,000) × $0.25 = **< $0.01/month**
- Storage: 100,000 docs × 1.5 KB avg = 150 MB → 0.15 GB × $0.25/GB = **$0.04/month**
- **Cosmos DB total**: ~$0.05/month

**Full stack estimate (private preview, 50 users)**:

| Service | Monthly Estimate |
|---|---|
| Cosmos DB Serverless | ~$0.05 |
| Azure Functions (Consumption) | ~$0.00 (first 1M executions free) |
| Azure Static Web Apps (Free tier) | $0.00 |
| Azure AD B2C (≤50,000 MAU) | $0.00 |
| Azure AI Foundry GPT-4o-mini (rate-limited) | ~$1–5 |
| **Total** | **~$1–5/month** |

Well under the $20–50 target and far below the $100 ceiling. Serverless is the right
Cosmos DB pricing model for private preview; switch to provisioned throughput only if
traffic grows substantially beyond 50 active users.
**Alternatives considered**:
- *Provisioned throughput (400 RU/s min)*: ~$23/month minimum — unnecessary at this scale.

---

## R-05: XSS Sanitisation — Client and Server

**Decision**: DOMPurify (client) + isomorphic-dompurify (server, Azure Functions)
**Rationale**: DOMPurify is the industry-standard browser-side HTML sanitiser, used in
600,000+ projects and independently audited. `isomorphic-dompurify` wraps DOMPurify with
`jsdom` for Node.js environments, enabling the exact same configuration on both client and
server (defence-in-depth). Having identical sanitisation config on both layers prevents
inconsistencies between what the server stores and what the client renders.

For WordSprout all user-provided text is plain text (not HTML). The sanitisation pass should
strip all HTML tags entirely using `ALLOWED_TAGS: []` to prevent any injection. AI-generated
responses must be sanitised with the same profile — they are untrusted input per FR-033.
**Alternatives considered**:
- *sanitize-html*: Valid choice but separate API configuration from DOMPurify, requiring
  two configs to maintain. isomorphic-dompurify gives a single shared config.
- *No server-side sanitisation (client-only)*: Rejected. Server is the authoritative
  security boundary (FR-034, FR-035). Client-side sanitisation alone is insufficient.

---

## R-06: JWT Validation + Allow-List Enforcement in Azure Functions

**Decision**: Shared `authorise` utility function using `jsonwebtoken` + `jwks-rsa` +
Cosmos DB point-read for allow-list check
**Rationale**: Azure Functions Node.js v4 does not have a built-in middleware pipeline.
The cleanest pattern is a shared `authorise(req)` utility that every HTTP trigger calls
before any business logic. It:

1. Extracts the `Authorization: Bearer <token>` header.
2. Fetches the Azure AD B2C JWKS endpoint (cached in memory for 1 hour) using `jwks-rsa`.
3. Validates the JWT signature, issuer, and audience using `jsonwebtoken`.
4. Performs a Cosmos DB point-read (`/userId/<sub>`, type `"allowlist"`) to confirm the
   user is on the allow-list.
5. Returns the decoded claims on success or throws a 401/403 accordingly.

JWKS key caching avoids a network call on every request. The allow-list Cosmos DB read is
a point-read (1 RU) keyed by `userId`, so it is fast and cheap.
**Alternatives considered**:
- *Azure Functions `authLevel: "function"` key-based auth*: Not applicable — this is for
  API keys, not user identity.
- *Custom middleware via a wrapper function*: Creates unnecessary abstraction; optional for
  a future refactor when function count grows beyond ~10.
- *In-memory allow-list cache*: Could cache the allow-list lookup per user per Function
  cold-start to save ~1 RU per request. Deferred to Phase 2 — adds complexity and the cost
  is negligible at 50 users.

---

## Summary of Decisions

| ID | Question | Decision |
|----|----------|----------|
| R-01 | Offline search library | MiniSearch |
| R-02 | Offline sync mechanism | Online-event replay-queue (no Background Sync API) |
| R-03 | Cosmos DB container model | Single container, partition key `/userId`, type discriminator |
| R-04 | Cosmos DB cost | ~$0.05/month; full stack ~$1–5/month for private preview |
| R-05 | XSS sanitisation | DOMPurify (client) + isomorphic-dompurify (server) |
| R-06 | JWT + allow-list enforcement | `authorise()` utility: `jsonwebtoken` + `jwks-rsa` + Cosmos point-read |
