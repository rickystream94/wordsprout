# Research: Learning Score Decay

**Phase 0 output** | Branch: `feature/008-learning-score-decay` | Date: 2026-05-17

---

## Decisions

### Decision 1: Compute decay client-side on user-initiated load

**Decision**: Decay is computed entirely in the browser (IndexedDB), triggered when the authenticated user opens the app. No new Azure infrastructure is added.

**Rationale**: The spec explicitly forbids background jobs. The app already has a `pullFromServer` function called on app load, visibility change, and online events — decay runs in the same lifecycle. IndexedDB bulk modifications are synchronous enough to be imperceptible to the user.

**Alternatives considered**:
- Azure Timer Trigger Function: Rejected. Would require a Consumption plan with always-on or Durable Functions, violating the cost ceiling and HTTP-only constraint.
- Azure Logic Apps or scheduled event: Rejected for same cost/architecture reasons.
- Cosmos DB TTL: Rejected. TTL deletes documents; it does not modify a field within a document.

---

### Decision 2: Store once-per-day guard in IndexedDB `meta` table

**Decision**: Use the existing `db.meta` Dexie table (key-value store already holding `lastPull`) to persist a `lastDecay` key set to today's UTC date string (`YYYY-MM-DD`). No Dexie schema version bump is required.

**Rationale**: The `meta` table already exists and is purpose-built for exactly this pattern (see `lastPull` in `sync.ts`). Adding a `lastDecay` key requires zero schema changes.

**Alternatives considered**:
- `localStorage`: Rejected. `db.meta` is already the canonical client-side key-value store; using a second store would create inconsistency.
- New Dexie table: Overkill for a single key.

---

### Decision 3: Decay constants, formula, and multi-device idempotency

**Decision**:
- Grace period: **7 days** after `lastReviewedDate`
- Decay rate: **−1 point per 3 days** after grace period expires
- New field: `decayBaseScore` — set on every review session completion alongside `lastReviewedDate`; anchors the formula
- Formula:
  - `targetScore = max(0, decayBaseScore − floor(max(0, daysElapsed − 7) / 3))`
  - `newScore = min(currentScore, targetScore)` — decay never raises a score
- Entries with `decayBaseScore = null` or `lastReviewedDate = null` receive no decay.

**Rationale**: User-selected (Option B + 7-day grace, changed from original 14). The `decayBaseScore` anchor ensures any device running the same formula against the same `decayBaseScore` + `lastReviewedDate` produces the same `targetScore`, making the decay pass idempotent under last-write-wins sync. At max score 100, an Engraved entry stays Engraved for ~70 days and reaches 0 in ~307 days.

**Alternatives considered**: Options A, C, D decay paces were presented; B+7 was chosen. For multi-device idempotency, Option C (server-side `lastDecayDate`) was rejected because it adds a new API concept and extra round-trip; Option B (tolerate double-decay) was rejected as incorrect.

---

### Decision 4: Separate `decay.ts` service module

**Decision**: Introduce a new `frontend/src/services/decay.ts` module that imports from `scoring.ts`, `db.ts`, and `sync.ts`. The decay runner lives here to avoid circular dependencies.

**Note**: `FlashcardSession.tsx` is also updated to write `decayBaseScore` on every review completion, but that change is a one-liner alongside the existing `learningScore` + `lastReviewedDate` write.

**Rationale**: `db.ts` cannot import from `sync.ts` (circular dependency). Placing decay logic in a dedicated module that is imported only from `main.tsx` keeps the dependency graph acyclic and follows existing service module conventions.

**Alternatives considered**:
- Add decay to `sync.ts`: Rejected — `sync.ts` is already large and decay is a distinct concern.
- Add decay to `db.ts` and pass `enqueueMutation` as a callback: Possible but adds indirection without benefit.

---

### Decision 5: UTC date used for all decay calculations

**Decision**: `todayKey()` in `scoring.ts` returns today's date using `toLocaleDateString('sv')`, which effectively gives local date in `YYYY-MM-DD` format. For decay, the same helper is used so the day boundary is consistent with review session date stamping.

**Rationale**: `FlashcardSession.tsx` already uses `todayKey()` to stamp `lastReviewedDate`. Using the same function ensures date comparisons are self-consistent. The spec says UTC; `sv` locale returns local system date. For a personal learning app this is acceptable — all operations on one device use the same clock.

**Alternatives considered**:
- True UTC date: Slightly more correct for cross-timezone users, but `lastReviewedDate` is already stamped with local date in the existing implementation, so mixing conventions would introduce a different inconsistency.

---

### Decision 6: Only mutate entries whose score actually changes

**Decision**: During `applyDecayRound`, only entries where `computedDecay > 0` (i.e., the score would change) are written to IndexedDB and enqueued for sync. Entries already at `0` or within the grace period are skipped entirely.

**Rationale**: Minimises IndexedDB write load and avoids generating superfluous sync mutations (PUT requests) for unchanged data. This keeps Azure Functions invocations — and therefore Cosmos DB RU consumption — proportional to actual decay events.

---

### Decision 7: No UI indicator for decay in this feature scope

**Decision**: This feature does not add any new UI element to explain or visualise the decay. The existing `LearningScoreBar` component already renders the updated `learningScore` value; a returning user will simply see lower scores.

**Rationale**: The spec does not require a UI indicator. Adding one would be scope creep for this feature. A "score decayed" badge or explanation tooltip can be added as a follow-up if user research suggests confusion.

---

### Decision 8: Decay constants sourced from Vite environment variables

**Decision**: `DECAY_GRACE_DAYS` and `DECAY_RATE_DAYS` are read from `import.meta.env.VITE_DECAY_GRACE_DAYS` and `import.meta.env.VITE_DECAY_RATE_DAYS` at module load time, with production defaults of `7` and `3` respectively. Values are parsed as integers; invalid or missing values fall back to the defaults.

**Rationale**: Local development and staging environments need to verify decay behaviour quickly without waiting 7+ days. Vite env vars are the established pattern in this codebase (see `frontend/src/config/env.ts`). Build-time constants mean zero runtime cost and no security exposure.

**Alternatives considered**:
- Hardcoded constants: Rejected per FR-012. Makes testing cumbersome.
- Runtime config endpoint: Overkill; adds a server round-trip for values that never change per deployment.

---

## Open questions (resolved)

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Decay pace model | Option B + 7-day grace: −1 pt/3 days after day 7 |
| Q2 | Where to trigger decay | Client-side, alongside `pullFromServer` in `main.tsx` |
| Q3 | How to enforce once-per-day | `db.meta` key `lastDecay` checked before any writes |
| Q4 | What happens to entries never reviewed (`lastReviewedDate = null`) | No decay applied; `decayBaseScore` will also be null |
| Q5 | Multi-device idempotency | Option A: `decayBaseScore` field anchors formula; same inputs → same output on every device |
