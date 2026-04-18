# Tasks: Adaptive Learning State & Redesigned Review Sessions

**Feature**: `002-adaptive-learning-state` | **Branch**: `002-adaptive-learning-state`
**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

---

## Phase 1: Setup

**Purpose**: Install new dependency and prepare the monorepo for this feature's code.

- [x] T001 Install `fastest-levenshtein` in `frontend/package.json` (`cd frontend && npm install fastest-levenshtein`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions, Dexie schema migration, and the scoring service. Every user story depends on these — no story work can begin until this phase is complete.

**⚠️ CRITICAL**: Complete this phase in order (T002 → T003 → T004 → T005 → T006). T003 depends on T002; T004 depends on T002; T005 depends on T004; T006 depends on T005.

- [x] T002 Remove `LearningState` type and add `learningScore: number` + `lastReviewedDate: string | null` to `VocabularyEntry` in `api/src/models/types.ts`
- [x] T003 [P] Mirror the same type changes (remove `LearningState`, add `learningScore`, `lastReviewedDate`) in `frontend/src/types/models.ts`
- [x] T004 Update `DBEntry` interface in `frontend/src/services/db.ts` to replace `learningState: LearningState` with `learningScore: number` and `lastReviewedDate: string | null`
- [x] T005 Add Dexie `version(2)` schema block with updated index (`learningScore` replaces `learningState`) and `upgrade()` migration function that maps `new→0`, `learning→30`, `mastered→90` and sets `lastReviewedDate = null` in `frontend/src/services/db.ts`
- [x] T006 Create `frontend/src/services/scoring.ts` with `normalize()`, `splitGraphemes()`, `maxTypos()`, `evaluateAnswer()`, `computeScoreDelta()`, `applyDelta()`, and `scoreToRange()` per the formulas in `data-model.md`

**Checkpoint**: Types compile, Dexie migrates, scoring functions are importable. All later phases can proceed.

---

## Phase 3: User Story 1 — Visual Learning Progress at a Glance (Priority: P1) 🎯 MVP

**Goal**: Replace the `LearningStateToggle` enum pill with a heat-map progress bar on every phrasebook entry. Delivers visible change with zero session logic.

**Independent Test**: Open the phrasebook list; every entry shows a color-coded progress bar proportional to its `learningScore` (seeded at 0 / 30 / 90 from migration). No review session required.

- [x] T007 [P] [US1] Create `frontend/src/components/entry/LearningScoreBar.tsx` — renders a `<div>` track with a fill `<div>` styled to `score%` width; applies CSS class `fill_new` / `fill_learning` / `fill_mastered` based on `scoreToRange(score)`
- [x] T008 [P] [US1] Create `frontend/src/components/entry/LearningScoreBar.module.css` — `.track` (grey container, fixed height, rounded), `.fill` (absolute fill), `.fill_new` (cool blue), `.fill_learning` (amber), `.fill_mastered` (warm green)
- [x] T009 [US1] Replace all usages of `LearningStateToggle` in `frontend/src/components/entry/EntryList.tsx` (and any other entry display components) with `<LearningScoreBar score={entry.learningScore} />`
- [x] T010 [US1] Delete `frontend/src/components/entry/LearningStateToggle.tsx` and `LearningStateToggle.module.css` (remove files and all remaining import references)
- [x] T011 [US1] Fix any TypeScript errors introduced by the `LearningState` removal across `frontend/src/` — search for remaining references to `learningState` field or `LearningState` type and update them

**Checkpoint**: App compiles and runs. Phrasebook entries display a heat-map bar. `LearningStateToggle` is fully gone.

---

## Phase 4: User Story 2 — Earn Points Through Active Review (Priority: P1)

**Goal**: Typed-input flashcard review loop: show source prompt → user types target → evaluate → persist score immediately → next card. Correct/incorrect/skip all change `learningScore` atomically per card.

**Independent Test**: Start a review session (any type), submit correct and incorrect answers, exit mid-session. Verify: (a) score bars update after each card; (b) exiting retains all changes; (c) entries at 0 cannot go negative.

- [x] T012 [P] [US2] Create `frontend/src/components/review/FlashcardSession.tsx` — manages active session state: current card index, user input value, evaluation result, loading state. On "Submit": calls `evaluateAnswer()` + `computeScoreDelta()`, writes updated `learningScore` and `lastReviewedDate` to Dexie via `updateEntry()`, enqueues `PUT /entries/:id` mutation via `enqueueMutation()`, shows result for ~1.5 s, advances to next card. On "Skip": applies −5 delta, same persist pattern. Renders `ReviewCard` for each flashcard.
- [x] T013 [P] [US2] Create `frontend/src/components/review/FlashcardSession.module.css` — styles for session container, progress counter, result overlay (correct/incorrect/skip feedback), next-card transition
- [x] T014 [US2] Create `frontend/src/components/entry/ReviewCard.tsx` (replace existing file entirely) — displays `sourceText` as the prompt; renders a text `<input>` for the user's answer; "Submit" and "Skip" buttons; accepts `onSubmit(input: string)`, `onSkip()` props; no reveal mechanic
- [x] T015 [US2] Update `frontend/src/components/entry/ReviewCard.module.css` to match the new typed-input card layout (remove old reveal/state-toggle styles)
- [x] T016 [US2] Add `getEntriesForSession(userId: string, type: 'random' | 'targeted', size: number): Promise<DBEntry[]>` to `frontend/src/services/db.ts` — for `random`: fetch all entries, Fisher-Yates shuffle, take `size`; for `targeted`: fetch entries with `learningScore < 80`, sort ascending by `learningScore`, shuffle equal-score groups, take `size`

**Checkpoint**: A complete review loop works end-to-end: open session → answer cards → exit → scores persisted in IndexedDB → progress bars updated.

---

## Phase 5: User Story 3 — Use Hints to Aid Recall (Priority: P2)

**Goal**: Add a "Hint" button to each flashcard that reveals one random unrevealed grapheme cluster of the normalized answer. Point gain is penalized proportionally by hints used.

**Independent Test**: Request 0, 1, and N hints on cards of known length. Confirm the point gain decreases proportionally. Confirm that an answer typed with all hints used yields +1 (minimum gain).

- [x] T017 [US3] Extend `FlashcardSession.tsx` to track `hintsUsed: number` and `revealedIndices: Set<number>` per card in component state; reset both on card advance
- [x] T018 [US3] Add `getHint(revealedIndices: Set<number>, graphemes: string[]): { index: number; char: string } | null` helper in `frontend/src/services/scoring.ts` — picks a random unrevealed grapheme index; returns `null` if all are revealed
- [x] T019 [US3] Wire "Hint" button in `ReviewCard.tsx` — calls `onHint()` prop; parent (`FlashcardSession`) calls `getHint()`, adds returned index to `revealedIndices`, increments `hintsUsed`, pre-fills the revealed character at its position in the input field
- [x] T020 [US3] Pass `hintsUsed` and `answerGraphemes.length` into `computeScoreDelta()` call inside `FlashcardSession.tsx` — already supported by the function signature; ensure the call site passes the correct values (was previously hardcoded to 0)

**Checkpoint**: Hint button appears on each card; each press fills in one letter; point gain visibly decreases with more hints used.

---

## Phase 6: User Story 4 — Flexible Session Types (Priority: P2)

**Goal**: Pre-session setup screen lets users choose Random vs Targeted and set a session size. Targeted sessions gate on zero-eligible-entries check before starting.

**Independent Test**: (a) Start a Targeted session → only entries with score < 80 appear. (b) Start a Random session → all entries (including Mastered) eligible. (c) Attempt Targeted when all entries are Mastered → blocked with message, no session starts. (d) Request size 50 with only 3 eligible entries → session starts with 3 cards.

- [x] T021 [P] [US4] Create `frontend/src/components/review/SessionSetup.tsx` — renders two session-type buttons (Random / Targeted) with descriptions; a numeric size picker (default 20, min 1); a "Start" button that calls `onStart({ type, requestedSize })` prop; if type is Targeted and zero eligible entries exist (checked via `getEntriesForSession` preview count), shows an inline message and disables Start
- [x] T022 [P] [US4] Create `frontend/src/components/review/SessionSetup.module.css` — styles for the setup card, type selector, size picker, and the zero-entries warning state
- [x] T023 [US4] Redesign `frontend/src/pages/Review.tsx` — implement a `phase` state machine: `'setup' | 'session' | 'summary'`; in `setup` phase renders `<SessionSetup />`; in `session` phase renders `<FlashcardSession />`; in `summary` phase renders a results summary (cards attempted, correct count, total score delta); "Start over" returns to setup
- [x] T024 [US4] Update `frontend/src/pages/Review.module.css` to support the three-phase layout (remove old filter-pill + exit-button-only styles; add summary phase styles)

**Checkpoint**: Full session flow works: setup → session → summary. Both session types filter entries correctly. Zero-eligible guard prevents empty Targeted sessions.

---

## Phase 7: User Story 5 — Daily Review Limit Per Entry (Priority: P3)

**Goal**: Entries already reviewed today show a visual indicator on their flashcard and produce no score change when submitted or skipped.

**Independent Test**: Review an entry; immediately start another session containing the same entry; submit any answer → no score change, indicator visible. On the next calendar day → entry is reviewable again.

- [x] T025 [US5] In `FlashcardSession.tsx`, when building the flashcard list from `getEntriesForSession()`, compute `reviewedToday: entry.lastReviewedDate === new Date().toLocaleDateString('sv')` for each card and include it in the flashcard object passed to `ReviewCard`
- [x] T026 [US5] In `FlashcardSession.tsx` submission handler, skip the `updateEntry()` / `enqueueMutation()` calls when `flashcard.reviewedToday === true`; outcome is forced to `'no_change'` with `scoreDelta: 0`
- [x] T027 [US5] In `ReviewCard.tsx`, accept a `reviewedToday: boolean` prop; when true, render a visible badge or banner (e.g., "Already reviewed today — no score change") on the card

**Checkpoint**: Daily limit indicator appears and no DB writes occur for already-reviewed entries. Score bars do not change for repeated same-day reviews.

---

## Phase 8: API — Server-Side Validation (FR-021 & FR-022)

**Purpose**: Enforce server-side delta bounds [−5, +10] and the daily-review-once constraint on `PUT /entries/:id` (FR-021, FR-022). No new endpoints — adds two validation rules to the existing handler.

- [x] T028 [P] Update `api/src/models/types.ts` — `VocabularyEntry`: remove `learningState: LearningState`, add `learningScore: number` and `lastReviewedDate: string | null` (mirrors T002 on the frontend side)
- [x] T029 Update `api/src/functions/entries.ts` PUT handler to: (1) validate `learningScore` is an integer 0–100 if present; (2) fetch the current entry from Cosmos and enforce that `newScore − currentScore` is within [−5, +10] (FR-021), returning HTTP 400 if violated; (3) enforce that `lastReviewedDate` differs from the current stored value before accepting a score change (FR-022), returning HTTP 400 if the same date is submitted twice; (4) remove any remaining references to `learningState` field in the write path

**Checkpoint**: Direct API calls with out-of-range deltas or duplicate-day dates are rejected with HTTP 400. Legitimate sync payloads from the client pass through.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T030 [P] Audit all remaining usages of `LearningState`, `learningState`, and `getEntriesByLearningState` across both `frontend/` and `api/` — update or remove any survivors not already addressed in prior phases
- [x] T031 [P] Update `frontend/src/services/db.ts` `getEntriesByLearningState` function: rename to `getEntriesByScoreRange` with signature `(userId: string, range: 'new' | 'learning' | 'mastered' | null)` that queries `learningScore` index ranges using Dexie `.where('learningScore').between(...)`
- [x] T032 [P] Verify offline behaviour end-to-end: run a full session with DevTools Network set to Offline; confirm all score writes land in `pendingSync`; re-enable network; confirm `replayQueue()` syncs all mutations to the API
- [x] T033 [P] Update `frontend/src/pages/PhrasebookView.tsx` (and any other page that renders entry lists) to pass `entry.learningScore` to `<LearningScoreBar>` and remove any remaining `learningState`-based conditional rendering or class logic
- [x] T034 [P] Update `frontend/src/services/search.ts` if it indexes or filters on `learningState` — replace with `learningScore` field reference

---

## Phase 10: PWA Installability & Background Sync (FR-023–FR-025, SC-008)

**Purpose**: Close the gaps introduced by clarifications in Session 2026-04-18. The manifest and `<link rel="manifest">` already exist and are FR-023 compliant. The three tasks below address: (1) the SW Background Sync event not yet wired, (2) a potential ASCII-only `normalize()` that predates the Unicode Cat P+S mandate, and (3) the FR-022 server logic that was implemented against the old spec.

**⚠️ NOTE**: T036 and T037 are corrective amendments to already-completed tasks (T006 and T029 respectively). Complete them even though the originals are marked `[x]`.

- [x] T035 Wire Workbox Background Sync in `frontend/vite.config.ts`: add a `workbox-background-sync` `BackgroundSyncPlugin` (or configure the Workbox `backgroundSync` option) to the `api-cache` `NetworkFirst` runtime cache entry for `/api/entries/*` PUT requests, using the sync queue tag `'vocabook-score-sync'`; this ensures the SW `sync` event replays queued mutations on Android Chrome when connectivity is restored — the existing `online` + `visibilitychange` handlers in `main.tsx` already cover the iOS Safari fallback (FR-024, FR-025)
- [x] T036 [P] Verify and fix `normalize()` in `frontend/src/services/scoring.ts` (FR-005/FR-006): confirm the punctuation-stripping regex uses `/[\p{P}\p{S}]/gu` (Unicode General Categories P + S) with the `u` flag; if the current implementation uses ASCII-only stripping (e.g., `/[^\w\s]/g` or a character-class list), replace it with the Unicode regex; add or update unit tests in the scoring test file to assert that Arabic (`،`), CJK (`。`), and Hebrew (`׃`) punctuation is stripped correctly
- [x] T037 [P] Fix the FR-022 daily-review gate in `api/src/functions/entries.ts` PUT handler: replace the current check ("submitted `lastReviewedDate` equals stored value") with a server-authoritative UTC date comparison — compute `const todayUtc = new Date().toISOString().slice(0, 10)` and reject with HTTP 400 if `todayUtc === storedEntry.lastReviewedDate`; the client-submitted `lastReviewedDate` value MUST be ignored for this gate (FR-022)
- [ ] T038 Manual QA gate — SC-008: on a physical iOS device open the deployed app in Safari, use the share sheet → "Add to Home Screen" and confirm the app installs and launches in standalone mode with no address bar; on an Android device open the app in Chrome, accept the install prompt or use "Add to Home Screen", and confirm standalone launch; verify a full review session completes with DevTools Network → Offline; record pass/fail as a PR comment before merge

---

## Dependencies

```
Phase 1 (T001)
    └─► Phase 2 (T002–T006)   [all phases block on Phase 2]
            ├─► Phase 3 (T007–T011)   [US1 — can start as soon as Phase 2 done]
            ├─► Phase 4 (T012–T016)   [US2 — can start as soon as Phase 2 done]
            │       └─► Phase 5 (T017–T020)   [US3 — extends Phase 4 components]
            │               └─► Phase 6 (T021–T024)   [US4 — wraps Phases 4+5]
            │                       └─► Phase 7 (T025–T027)   [US5 — extends Phase 6]
            └─► Phase 8 (T028–T029)   [API — independent of frontend phases]
Phase 9 (T030–T034)   [cleanup — after all prior phases]
Phase 10 (T035–T038)  [PWA/corrective — independent of all other phases; T036 and T037 are
                        amendments to T006/T029 and may run in parallel with each other]
```

**Phases 3 and 8 can proceed in parallel once Phase 2 is complete.**

---

## Parallel Execution Examples

### After Phase 2 is complete, two streams can run in parallel:

**Stream A — Frontend**
```
T007+T008 (LearningScoreBar) → T009+T010+T011 (wire + delete toggle) → T012–T016 (FlashcardSession, new ReviewCard) → T017–T020 (hints) → T021–T024 (session setup + Review page) → T025–T027 (daily limit UI)
```

**Stream B — API**
```
T028 (type update) → T029 (entry PUT validation)
```

**Within each phase**, tasks marked `[P]` targeting different files may be worked on simultaneously.

---

## Implementation Strategy

**MVP scope = Phases 1–4** (T001–T016)

Delivers: new numeric score persisted in IndexedDB, migration of existing entries, heat-map bar visible in phrasebook, complete typed-input review loop with scoring. The app is fully functional and testable end-to-end at this point.

- **Phase 5** (hints) adds UX depth to the review loop
- **Phase 6** (session types) gives users agency over practice mode
- **Phase 7** (daily limit) adds integrity enforcement
- **Phase 8** (API validation) adds server-side abuse resistance
- **Phase 9** (polish) ensures no dead code or broken references remain

Each phase can be reviewed and merged independently as a pull-request increment.

---

## Format Validation

All tasks follow `- [x] [ID] [P?] [Story?] Description with file path`:
- ✅ All 38 tasks have checkbox + sequential ID
- ✅ `[P]` present only on tasks with no intra-phase dependency and different target files
- ✅ `[US1]–[US5]` labels present on all user-story phase tasks; absent on Setup/Foundational/API/Polish/PWA phases
- ✅ Every task includes an exact file path or explicit file operation
