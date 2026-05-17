# Tasks: Learning Score Decay

**Input**: Design documents from `specs/008-learning-score-decay/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies on incomplete tasks)
- **[US1/US2/US3]**: Which user story this task delivers
- All paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Extend environment variable example files so all developers know the new configurable constants exist and how to override them locally.

- [X] T001 Add `VITE_DECAY_GRACE_DAYS` and `VITE_DECAY_RATE_DAYS` to `frontend/.env.example` (or equivalent env template) with production default values of `7` and `3` and a comment explaining each constant and how to override for local testing (e.g. `VITE_DECAY_GRACE_DAYS=0`, `VITE_DECAY_RATE_DAYS=1`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data model extension and pure decay formula — both stories and all tests depend on these being complete first.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Add `decayBaseScore: number | null` field to the `DBEntry` interface in `frontend/src/services/db.ts` (after the `lastReviewedDate` field; `null` means entry has never been reviewed in a session)
- [X] T003 [P] Add `DECAY_GRACE_DAYS` and `DECAY_RATE_DAYS` constants sourced from `import.meta.env.VITE_DECAY_GRACE_DAYS` / `VITE_DECAY_RATE_DAYS` with integer parsing and safe production defaults (`7` and `3`) to `frontend/src/services/scoring.ts`; add `computeDecay(currentScore, decayBaseScore, lastReviewedDate, today)` pure function implementing `targetScore = max(0, decayBaseScore − floor(max(0, daysElapsed − DECAY_GRACE_DAYS) / DECAY_RATE_DAYS))` then `newScore = min(currentScore, targetScore)`; export all
- [X] T004 Add unit tests for `computeDecay` to `frontend/src/services/__tests__/scoring.test.ts` covering: grace period boundary (days ≤ DECAY_GRACE_DAYS → no change), first decay tick (day GRACE+1 → still 0 points until RATE threshold), correct delta after grace, floor clamping to 0, null `decayBaseScore` → no change, null `lastReviewedDate` → no change, `currentScore === 0` → no change, idempotency (score already at target → unchanged), env-var-overridden constants produce correct results

**Checkpoint**: `computeDecay` is tested and exported. `DBEntry` has `decayBaseScore`. User story phases can now proceed.

---

## Phase 3: User Story 1 — Honest Score Reflection After Inactivity (Priority: P1) 🎯 MVP

**Goal**: When a returning user opens the app after the grace period, all eligible entries have their `learningScore` automatically reduced according to the decay formula, persisted to IndexedDB, and enqueued for server sync — at most once per calendar day.

**Independent Test**: Set an entry to `learningScore: 100`, `decayBaseScore: 100`, `lastReviewedDate` 20 days ago; clear the `lastDecay` meta key; reload the app. Entry score should be `97` (`floor((20−7)/3) = 4` → 96, wait: `floor(13/3) = 4`, score `96`). The `lastDecay` meta key is set to today.

- [X] T005 [US1] Create `frontend/src/services/decay.ts` exporting `applyDecayRound(userId: string, apiBase: string): Promise<void>`; implementation: (1) read `todayKey()`, (2) check `db.meta.get('lastDecay')` — return early if value equals today, (3) fetch all `DBEntry` records for `userId`, (4) for each entry skip if `learningScore === 0` or `decayBaseScore === null` or `lastReviewedDate === null`, (5) call `computeDecay(entry.learningScore, entry.decayBaseScore, entry.lastReviewedDate, today)`, skip if result equals `entry.learningScore`, (6) bulk-update changed entries via `db.entries.update(id, { learningScore: newScore, updatedAt: now })`, (7) enqueue one `PUT` mutation per changed entry via `enqueueMutation(\`${apiBase}/entries/${id}\`, 'PUT', { ...entry, learningScore: newScore })`, (8) write `db.meta.put({ key: 'lastDecay', value: today })`
- [X] T006 [P] [US1] Create `frontend/src/services/__tests__/decay.test.ts` with unit tests for `applyDecayRound` using Vitest and mocked `db` / `enqueueMutation`; cover: once-per-day guard (second call same day → no writes), entries with null fields are skipped, entries in grace period are skipped, entries at score 0 are skipped, entries needing decay are updated and mutations enqueued, only changed entries generate mutations, `lastDecay` meta key written after pass
- [X] T007 [US1] Wire `applyDecayRound(userId, API_BASE)` to the authenticated app lifecycle in `frontend/src/main.tsx`: call it inside the `online` event handler (after `pullFromServer`), inside the `visibilitychange` handler (after `pullFromServer`), and after the initial authenticated pull completes on app load — guard each call with `getStoredAccessToken()` and a resolved `userId` check, matching the existing pattern for `pullFromServer`

**Checkpoint**: US1 fully functional. Returning user opens app → decayed scores visible. `lastDecay` guard prevents re-run same day.

---

## Phase 4: User Story 2 — Score Recovery Through Practice (Priority: P2)

**Goal**: When a user completes a review session, `decayBaseScore` is written alongside `learningScore` and `lastReviewedDate`, anchoring the decay formula to the new post-review score and resetting the grace period clock.

**Independent Test**: Decay an entry to score 80. Complete a review session answering it correctly (score rises to 90). Set `lastReviewedDate` to today. Clear `lastDecay`. Advance clock 10 days. Reload. Score should decay from base `90` (3 post-grace days → `floor(3/3) = 1` → 89), not from 80 or any other value.

- [X] T008 [P] [US2] Update both score-writing paths in `frontend/src/components/review/FlashcardSession.tsx` (`handleSubmit` and `handleReveal`) to include `decayBaseScore: newScore` in the `updateEntry` call and in the `enqueueMutation` body alongside the existing `learningScore: newScore` and `lastReviewedDate: today` writes
- [X] T009 [US2] Add or update tests in `frontend/src/components/review/__tests__/FlashcardSession.test.tsx` to assert that after a scored answer `decayBaseScore` equals `newScore` in both the `updateEntry` call arguments and the enqueued mutation body; cover both `handleSubmit` (correct, typo, wrong) and `handleReveal` paths

**Checkpoint**: US2 functional. Reviewed entries correctly anchor their decay baseline.

---

## Phase 5: User Story 3 — Consistent Scores Within a Single Day (Priority: P3)

**Goal**: Opening the app multiple times on the same calendar day never triggers a second decay pass — scores are stable within a day.

**Independent Test**: Open the app (decay runs, `lastDecay` set to today). Open again same day. Verify that no IndexedDB writes occurred on the second open and no new sync mutations were enqueued.

> **Implementation note**: US3 is fully covered by the `lastDecay` guard already implemented in T005. No new implementation tasks are required. The tests in T006 already assert the once-per-day behaviour. This phase is satisfied when T005 and T006 are complete.

**Checkpoint**: US3 satisfied by T005/T006. No additional tasks.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Type safety and coverage gate before merge.

- [X] T010 Run `npx tsc --noEmit` from `frontend/` and fix all TypeScript errors introduced by this feature (particularly: `decayBaseScore` field on `DBEntry`, `computeDecay` signature, `applyDecayRound` imports in `main.tsx`)
- [X] T011 Run `npm run test:coverage` from `frontend/` and confirm coverage thresholds are met or exceeded; new code in `scoring.ts`, `decay.ts`, `FlashcardSession.tsx` must be covered by the tests from T004, T006, T009

---

## Dependencies

```
T001 (env vars)
  └─ no blockers

T002 (db.ts DBEntry) ──┐
T003 (scoring.ts)    ──┤
                       ├─► T004 (scoring tests)
                       ├─► T005 (decay.ts)
                       │     ├─► T006 (decay tests) [P]
                       │     └─► T007 (main.tsx wiring)
                       └─► T008 (FlashcardSession.tsx) [P with T005-T007]
                             └─► T009 (FlashcardSession tests)

T010 (tsc) ──► T011 (coverage) — run after all above complete
```

## Parallel Execution Opportunities

| Group | Tasks | Can run simultaneously after |
|---|---|---|
| Foundational | T002, T003 | T001 |
| Foundational tests | T004 | T003 |
| US1 + US2 implementation | T005, T008 | T002 + T003 |
| US1 tests | T006 | T005 design known |
| US1 wiring | T007 | T005 complete |
| US2 tests | T009 | T008 complete |

## Implementation Strategy

**MVP (deliver value first)**: Complete Phases 1–3 (T001–T007). This gives the full US1 decay loop end-to-end. Users returning after inactivity will see honest scores.

**Complete feature**: Add Phase 4 (T008–T009) to anchor `decayBaseScore` on review. Without this, decay is technically functional but not idempotent after a recovery session on a second device.

**Total tasks**: 11
**Tasks per user story**: US1 → 3, US2 → 2, US3 → 0 (covered by US1)
**Parallel opportunities**: T002‖T003, T005‖T008, T006‖T007‖T008
