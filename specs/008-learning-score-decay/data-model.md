# Data Model: Learning Score Decay

**Phase 1 output** | Branch: `feature/008-learning-score-decay` | Date: 2026-05-17

---

## Schema Changes

### No new Dexie schema version required

The decay feature reuses existing fields and tables. No Dexie version bump is needed.

---

### 1. `DBEntry` — one new field: `decayBaseScore`

One new field is added to `DBEntry`:

| Field | Type | Role in decay |
|---|---|---|
| `learningScore` | `number` (integer 0–100) | Updated in-place when decay is applied |
| `lastReviewedDate` | `string \| null` (`YYYY-MM-DD`) | Anchor date for the 7-day grace period |
| `decayBaseScore` | `number \| null` (integer 0–100, **new**) | Score at the time of the most recent review session completion. Anchors the decay formula so it is idempotent across devices. `null` for entries never reviewed. |

---

### 2. `DBMeta` — new key: `lastDecay`

The existing `meta` Dexie table (already used for `lastPull`) gains one new logical key:

| Key | Value format | Description |
|---|---|---|
| `lastDecay` | `YYYY-MM-DD` | The local date on which decay was last computed for this device. Prevents more than one decay pass per calendar day. |

No schema change — `meta` table already exists with schema `key` (primary key) + `value` (string).

---

### 3. `VocabularyEntry` (Cosmos DB) — one new field: `decayBaseScore`

The `decayBaseScore` field is added to Cosmos DB documents alongside `learningScore`. It is set by the existing `PUT /entries/:id` handler when a review session completes (same write that updates `learningScore` and `lastReviewedDate`). No migration is strictly required — existing documents without this field treat it as `null` (never reviewed), which means no decay is applied until the user's next review session.

---

## Decay Formula

```
graceExpiredDays = max(0, daysElapsed - DECAY_GRACE_DAYS)
decayPoints      = floor(graceExpiredDays / DECAY_RATE_DAYS)
targetScore      = max(MIN_SCORE, decayBaseScore - decayPoints)
newScore         = min(currentScore, targetScore)   // decay never raises a score
```

Where:
- `DECAY_GRACE_DAYS` = `VITE_DECAY_GRACE_DAYS` env var, defaulting to `7` in production
- `DECAY_RATE_DAYS` = `VITE_DECAY_RATE_DAYS` env var, defaulting to `3` in production
- `daysElapsed` = whole calendar days between `lastReviewedDate` and today
- `decayBaseScore` = score at time of last review (set once per review session)
- `MIN_SCORE = 0`

**Worked examples** (starting from `decayBaseScore = 100`):

| Days since last review | graceExpiredDays | decayPoints | targetScore | newScore |
|---|---|---|---|---|
| 0–7 (grace) | 0 | 0 | 100 | 100 |
| 10 | 3 | 1 | 99 | 99 |
| 13 | 6 | 2 | 98 | 98 |
| 37 | 30 | 10 | 90 | 90 |
| 70 | 63 | 21 | 79 (drops to Inscribed) | 79 |
| 307 | 300 | 100 | 0 (full decay) | 0 |

---

## New Service Module: `frontend/src/services/decay.ts`

### Purpose

Orchestrates the once-per-day decay pass: reads entries from IndexedDB, computes new scores, writes changed entries back, enqueues sync mutations to the server, and records the date in `db.meta`.

### Exported function

```typescript
/**
 * Applies learning score decay to all entries belonging to `userId`.
 * Runs at most once per calendar day (guarded by db.meta 'lastDecay' key).
 * Changed entries are persisted to IndexedDB and enqueued for server sync.
 *
 * @param userId  - The authenticated user's ID
 * @param apiBase - Base URL of the Azure Functions API (e.g. from API_BASE)
 */
export async function applyDecayRound(userId: string, apiBase: string): Promise<void>
```

### Internal flow

```text
1. today = todayKey()
2. lastDecayMeta = await db.meta.get('lastDecay')
3. If lastDecayMeta.value === today → return (already done today)
4. entries = all DBEntry records where userId matches
5. For each entry:
   a. If score === 0 or decayBaseScore === null or lastReviewedDate === null → skip
   b. newScore = computeDecay(entry.learningScore, entry.decayBaseScore, entry.lastReviewedDate, today)
   c. If newScore === entry.learningScore → skip (no change)
   d. Collect { id, newScore }
6. For each changed entry:
   a. db.entries.update(id, { learningScore: newScore, updatedAt: now })
   b. enqueueMutation(PUT /entries/:id, { learningScore: newScore })
7. db.meta.put({ key: 'lastDecay', value: today })
```

> `decayBaseScore` is NOT updated by the decay pass — only by review session completion.

---

## New Pure Function: `computeDecay` in `frontend/src/services/scoring.ts`

```typescript
/**
 * Computes the decayed score for an entry based on elapsed days since last review.
 * Uses decayBaseScore as the anchor so the result is idempotent across devices.
 * Returns the new score (clamped to MIN_SCORE; never higher than currentScore).
 *
 * @param currentScore    Current learning score (0–100)
 * @param decayBaseScore  Score at time of last review, or null (never reviewed)
 * @param lastReviewedDate 'YYYY-MM-DD' of last review, or null (never reviewed)
 * @param today           Today's date as 'YYYY-MM-DD' (from todayKey())
 */
export function computeDecay(
  currentScore: number,
  decayBaseScore: number | null,
  lastReviewedDate: string | null,
  today: string,
): number
```

Returns `currentScore` unchanged when:
- `currentScore === 0`
- `decayBaseScore === null` or `lastReviewedDate === null`
- Days elapsed ≤ `DECAY_GRACE_DAYS`

---

## Integration Points

| Location | Change |
|---|---|
| `frontend/src/services/scoring.ts` | Add `DECAY_GRACE_DAYS` and `DECAY_RATE_DAYS` constants sourced from `import.meta.env` with production defaults (7 and 3), and updated `computeDecay()` (takes `decayBaseScore`) |
| `frontend/src/services/decay.ts` | **New file** — `applyDecayRound()` orchestrator |
| `frontend/src/services/db.ts` | Add `decayBaseScore: number \| null` to `DBEntry` interface |
| `frontend/src/components/review/FlashcardSession.tsx` | Set `decayBaseScore: newScore` alongside `learningScore` + `lastReviewedDate` on every review write |
| `frontend/src/main.tsx` | Call `applyDecayRound(userId, API_BASE)` after successful auth, on visibility change, on online event |
| `frontend/src/services/__tests__/scoring.test.ts` | Unit tests for `computeDecay` |
| `frontend/src/services/__tests__/decay.test.ts` | **New file** — unit tests for `applyDecayRound` |

No changes to `api/` — existing `PUT /entries/:id` handler already accepts and persists any partial entry fields including the new `decayBaseScore`.
