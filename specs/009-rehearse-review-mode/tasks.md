# Tasks: Rehearse Review Mode

**Feature**: `009-rehearse-review-mode` | **Branch**: `feature/009-rehearse-review-mode`
**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/component-contracts.md`, `quickstart.md`

---

## Phase 1: Setup

**Purpose**: Confirm environment and prepare the feature branch. No new dependencies required.

- [X] T001 Verify `feature/009-rehearse-review-mode` is checked out and `npm install` is up to date in `frontend/` (no new packages needed — all dependencies already present)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Service functions and the `useSwipe` hook that multiple user stories depend on. Must be complete before any UI work begins.

**⚠️ CRITICAL**: Complete T002, T003, and T004 before any component work. All three are independent and can start in parallel.

- [X] T002 [P] Add `getEntriesForRehearsal(userId, type, size, phrasebookId, posFilter, tagFilter)` to `frontend/src/services/db.ts` — queries all entries for userId + phrasebookId, applies PoS filter (include if `posFilter` non-empty), applies tag OR-filter (include if `tagFilter` non-empty), applies targeted sort (asc `learningScore`) or Fisher-Yates shuffle, returns first `size` entries; makes no DB writes
- [X] T003 [P] Add `getAvailableTagsForPhrasebook(userId, phrasebookId)` to `frontend/src/services/db.ts` — queries entries for user + phrasebook, flattens all `tags` arrays, de-duplicates and sorts alphabetically; returns `string[]`
- [X] T004 [P] Create `frontend/src/hooks/useSwipe.ts` — generic `useSwipe<T extends HTMLElement>(options: UseSwipeOptions): React.RefObject<T | null>` hook; attaches `touchstart` / `touchend` listeners (passive) to the ref element; fires `onSwipeLeft` when horizontal delta ≤ −threshold (default 50 px) and `onSwipeRight` when delta ≥ threshold; cleans up listeners on unmount; no-op when element is null
- [X] T005 [P] Write tests for `getEntriesForRehearsal` in `frontend/src/services/__tests__/db.test.ts` — cases: empty pool returns `[]`; PoS filter includes/excludes correctly; tag filter uses OR within values; combined PoS + tag uses AND; `targeted` returns ascending learningScore order; `random` returns shuffled subset (mock `Math.random`); pool smaller than `size` returns full pool; no DB writes occur
- [X] T006 [P] Write tests for `getAvailableTagsForPhrasebook` in `frontend/src/services/__tests__/db.test.ts` — cases: returns deduplicated sorted tags; returns `[]` when no entries have tags; ignores entries from other phrasebooks
- [X] T007 [P] Write tests for `useSwipe` in `frontend/src/hooks/__tests__/useSwipe.test.ts` — cases: swipe left (delta ≥ threshold) calls `onSwipeLeft` once; swipe right calls `onSwipeRight` once; short movement (< threshold) calls neither; listeners removed on unmount (use `removeEventListener` spy)

**Checkpoint**: Service functions compile and pass tests. `useSwipe` hook is importable. All component phases can now proceed.

---

## Phase 3: User Story 1 — Start a Rehearse Session (Priority: P1) 🎯 MVP

**Goal**: A user selects "Rehearse" on the setup screen, starts a session, navigates all cards one at a time seeing full entry + enrichment metadata, and their learning scores are unchanged after the session ends.

**Independent Test**: Start a rehearse session from a phrasebook with enriched entries; navigate to the last card and finish; open DevTools → Application → IndexedDB and confirm `learningScore` on all session entries is identical to before the session.

- [X] T008 [P] [US1] Create `frontend/src/components/review/RehearseCard.tsx` — `article`-based presentational card; displays `sourceText` (large heading), `targetText` (large subheading), `partOfSpeech` badge (if present), `tags` chips (if non-empty), `notes` section (if present); renders enrichment sections only when `enrichment` prop is defined and each sub-field is non-empty: Example sentences, Synonyms, Antonyms, Collocations, Register, "⚠ False friend" warning; no interactive inputs; no score-related props; exports `RehearseCardProps` interface
- [X] T009 [P] [US1] Create `frontend/src/components/review/RehearseCard.module.css` — `.card` (clean card surface, generous padding, max-width ~640 px, centered), `.primary` (source + target in large font), `.sourceText` (xl weight), `.targetText` (xl, lighter weight), `.meta` (flex row of `.pos` badge + `.tag` chips), `.section` (top border, padding), `.sectionHeading` (small caps label), `.list` (unstyled list for example sentences)
- [X] T010 [US1] Create `frontend/src/components/review/RehearseSession.tsx` — accepts `entries: DBEntry[]`, `onDone: () => void`, `targetLanguageName?: string`, `sourceLanguageName?: string`; loads enrichments via `useLiveQuery` (single `anyOf` query by entryId); maintains `index` state (0-based); renders session header (exit button, progress counter `"N / Total"`, rehearse badge "Rehearse — scores not affected"), `<RehearseCard>` for current entry, and nav buttons ("← Prev" disabled at index 0, "Next →" / "Finish" at last card); attaches `useSwipe` ref to session container (swipe left = next, swipe right = prev); calls `onDone()` on exit or finish; MUST NOT import `updateEntry`, `enqueueMutation`, or anything from `services/scoring.ts`
- [X] T011 [P] [US1] Create `frontend/src/components/review/RehearseSession.module.css` — `.session` (full viewport height flex column), `.header` (flex row: exit btn left, progress centre, badge right), `.exitBtn` (text button), `.progress` (mono counter), `.rehearseBadge` (muted pill, always visible), `.nav` (sticky bottom flex row, prev/next buttons)
- [X] T012 [US1] Add `export type ReviewMode = 'competitive' | 'rehearse'` to `frontend/src/components/review/SessionSetup.tsx`; extend `SessionSetupProps.onStart` signature to `(mode: ReviewMode, type: SessionType, size: number, phrasebookId: string, posFilter: PartOfSpeech[], tagFilter: string[]) => void`; add a **Review mode** radio group (Competitive / Rehearse) at the top of the form; when `mode === 'rehearse'` show a notice "Rehearse sessions don't affect your learning score"; when `mode === 'competitive'` pass `posFilter: []` and `tagFilter: []` to `onStart`; reset posFilter and tagFilter when phrasebook selection changes
- [X] T013 [US1] Update `frontend/src/pages/Review.tsx` — import `RehearseSession` and `ReviewMode`; extend `handleStart` to accept the new `(mode, type, size, phrasebookId, posFilter, tagFilter)` signature; call `getEntriesForRehearsal` when `mode === 'rehearse'`, `getEntriesForSession` when `mode === 'competitive'`; store `reviewMode` in state; in the `phase === 'session'` branch render `<RehearseSession>` or `<FlashcardSession>` based on `reviewMode`; rehearse `onDone` returns to `'setup'` phase (no summary screen)
- [X] T014 [P] [US1] Write tests for `RehearseCard` in `frontend/src/components/review/__tests__/RehearseCard.test.tsx` — mock CSS module; cases: renders `sourceText` and `targetText`; renders `partOfSpeech` badge when present, absent when undefined; renders tags when non-empty, absent when empty; renders notes when present, absent when undefined/empty; renders no enrichment sections when `enrichment` is `undefined`; renders all enrichment sections when all fields populated; does not render empty-array enrichment sections; contains no form inputs, submit buttons, or score-related elements
- [X] T015 [P] [US1] Write tests for `RehearseSession` in `frontend/src/components/review/__tests__/RehearseSession.test.tsx` — mock `dexie-react-hooks` `useLiveQuery`; mock CSS module; cases: shows progress "1 / N"; "Next →" button advances to next card; "Finish" button on last card calls `onDone`; "← Exit" button calls `onDone`; "← Prev" button disabled on first card; progress counter updates on navigation; "scores not affected" badge always visible; document contains no references to score delta, learningScore mutation, `updateEntry`, or `enqueueMutation` imports (static import guard)
- [X] T016 [US1] Extend `SessionSetup` tests in `frontend/src/components/review/__tests__/SessionSetup.test.tsx` — cases: "Competitive" mode renders without PoS/tag filter fields; "Rehearse" mode renders the filter section; notice "scores not affected" visible in rehearse mode; `onStart` called with `mode: 'rehearse'` and empty `posFilter`/`tagFilter` when no filters selected; `onStart` called with `mode: 'competitive'` with empty arrays regardless

**Checkpoint**: US1 is fully functional and tested independently. User can start a rehearse session, navigate all cards, finish or exit, and scores are unchanged.

---

## Phase 4: User Story 2 — Navigate Cards with Swipe Gestures on Mobile (Priority: P2)

**Goal**: On touch-capable devices, swiping left advances the card and swiping right retreats. On desktop, arrow-key keyboard shortcuts provide equivalent navigation.

**Independent Test**: Open a rehearse session in Chrome DevTools with a mobile device profile enabled; swipe left and right through the deck without touching any buttons. All navigation works correctly.

- [X] T017 [P] [US2] Extend `RehearseSession` tests to cover swipe end-to-end behaviour — add test cases to `RehearseSession.test.tsx`: `useSwipe` `onSwipeLeft` callback advances index; `onSwipeLeft` on last card calls `onDone`; `onSwipeRight` on first card is a no-op (index stays 0); `onSwipeRight` retreats index from a non-zero position
- [X] T018 [P] [US2] Add `onKeyDown` handler to `RehearseSession.tsx` — attach to the session container div (`tabIndex={0}`, `autoFocus`); `ArrowRight` → `goNext()`; `ArrowLeft` → `goPrev()`; prevents default scroll behaviour for those keys
- [X] T019 [P] [US2] Extend `RehearseSession` tests to cover keyboard navigation — `ArrowRight` fires `goNext` (advances index); `ArrowLeft` fires `goPrev`; `ArrowLeft` no-ops on first card; `ArrowRight` on last card calls `onDone`
- [X] T020 [P] [US2] Update `RehearseSession.module.css` to add a subtle swipe-hint affordance on mobile (e.g., left/right chevron icons shown on the first render with a CSS fade-out animation) — CSS animation only (no JS interaction state); use `@media (hover: none)` to show only on touch devices; the icons animate out automatically after ~2 s via `@keyframes`

**Checkpoint**: US2 works independently. Swipe and keyboard navigation both functional. Hint affordance visible on mobile.

---

## Phase 5: User Story 3 — Filter Rehearsal by Part of Speech or Tag (Priority: P2)

**Goal**: Before starting a rehearse session, the user can select one or more parts of speech and/or one or more tags. Only matching entries are included in the session.

**Independent Test**: Select "noun" as a PoS filter in rehearse setup for a phrasebook that has nouns and verbs; start the session; confirm every card shown is a noun.

- [X] T021 [P] [US3] Add PoS multiselect to `SessionSetup.tsx` when `reviewMode === 'rehearse'` — derive available PoS values from the entries of the selected phrasebook (use `useLiveQuery` querying `db.entries.where('phrasebookId').equals(id).toArray()`, collect distinct `partOfSpeech` values); render as a set of checkbox labels for each available PoS; checked items stored in `posFilter: PartOfSpeech[]` state; show all `PartOfSpeech` union values but disable those not present in the phrasebook
- [X] T022 [P] [US3] Add tag multiselect to `SessionSetup.tsx` when `reviewMode === 'rehearse'` — call `getAvailableTagsForPhrasebook` via `useLiveQuery`; render as checkbox labels; checked items stored in `tagFilter: string[]` state; if no tags exist, hide the section entirely
- [X] T023 [US3] Wire filter feedback in `SessionSetup.tsx` — compute `filteredCount` (estimated entries matching current filters) via `useLiveQuery` on `db.entries`; when `filteredCount === 0` and filters are active: disable Start button and show "No entries match these filters — adjust filters to continue"; when `filteredCount < size` and `filteredCount > 0`: show "Only {filteredCount} matching entries — session will use all of them"; reset `posFilter` and `tagFilter` arrays when selected phrasebook changes
- [X] T024 [P] [US3] Update `SessionSetup.module.css` — add `.filterSection` (collapsible or always-visible group), `.filterGroup` (label + checkboxes column), `.filterNote` (muted helper text for count warnings), `.filterChip` (selected filter visual indicator)
- [X] T025 [P] [US3] Extend `SessionSetup` tests for filter interactions — PoS checkbox toggles update `posFilter` array; tag checkbox toggles update `tagFilter` array; zero-match state disables Start and shows error message; count-capped state shows adjusted count notice; filters reset when phrasebook changes; `onStart` called with correct `posFilter` and `tagFilter` arrays

**Checkpoint**: US3 works independently. Filtering by PoS and tag surfaces only matching entries. Edge cases (0 matches, partial match) handled gracefully.

---

## Phase 6: User Story 4 — Choose Entry Selection Strategy (Priority: P3)

**Goal**: The setup screen offers "Random sample" (default) and "Prioritise low learning score" as entry selection strategies, mirroring the existing competitive review behaviour.

**Independent Test**: Create a phrasebook with entries at scores 0, 50, and 100. Start a targeted rehearse session with size 2; confirm the two lowest-score entries always appear. Start a random session with size 2 multiple times; confirm the result is not always the same two entries.

- [X] T026 [US4] Confirm that the existing `SessionType` radio group in `SessionSetup.tsx` applies to rehearse mode; update the rendered label text conditionally: when `reviewMode === 'rehearse'` render labels as **"Random sample"** and **"Prioritise low score"**; when `reviewMode === 'competitive'` keep existing labels "Random" / "Targeted"; the `type` value passed to `onStart` remains `'random'` | `'targeted'` in both modes
- [X] T027 [US4] Verify `getEntriesForRehearsal` (T002) correctly handles `type: 'targeted'` with filters active — entries first filtered by PoS/tags, then sorted by ascending `learningScore`, then truncated to `size`; add a targeted test case in `db.test.ts` that combines PoS filter + `targeted` type and asserts sort order
- [X] T028 [P] [US4] Add default pre-selection test to `SessionSetup` tests — confirm `sessionType` defaults to `'random'` on initial render; confirm `'random'` label is pre-selected/highlighted

**Checkpoint**: US4 complete. Both selection strategies work correctly, independently and in combination with filters.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Type safety, accessibility, visual consistency, and coverage validation.

- [X] T029 [P] Run `npx tsc --noEmit` from `frontend/` and fix all TypeScript errors introduced by the new `ReviewMode` export, extended `onStart` signature, and new component props
- [X] T030 [P] Run `npm run test:coverage` from `frontend/` and confirm coverage thresholds have not regressed; address any newly uncovered lines in modified files (`Review.tsx`, `SessionSetup.tsx`, `db.ts`)
- [X] T031 [P] Accessibility audit of `RehearseCard` — ensure `article` has an accessible name (`aria-label` with entry source text); enrichment `section` elements have `h3` headings; tag chips have meaningful text; no colour-only information conveyed
- [X] T032 [P] Accessibility audit of `RehearseSession` — session container has `role="region"` and `aria-label="Rehearse session"`; progress counter has `aria-live="polite"`; nav buttons have descriptive `aria-label` values ("Go to previous card", "Go to next card"); exit button accessible
- [ ] T033 Verify manual quickstart checklist from `quickstart.md` end-to-end — all 8 manual verification steps pass locally; specifically confirm DevTools IndexedDB shows no score mutations after a complete rehearse session
- [X] T034 [P] Extend `Review.tsx` tests in `frontend/src/pages/__tests__/Review.test.tsx` (create file if it does not exist) — cases: `handleStart` calls `getEntriesForRehearsal` when `mode === 'rehearse'`; `handleStart` calls `getEntriesForSession` when `mode === 'competitive'`; `phase === 'session'` renders `<RehearseSession>` when `reviewMode === 'rehearse'`; `phase === 'session'` renders `<FlashcardSession>` when `reviewMode === 'competitive'`; rehearse `onDone` returns to `'setup'` phase without going to summary

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all component phases
- **Phase 3 (US1)**: Depends on Phase 2 (service functions + `useSwipe`)
- **Phase 4 (US2)**: Depends on Phase 3 (`RehearseSession` must exist before wiring keyboard events)
- **Phase 5 (US3)**: Depends on Phase 3 (`SessionSetup` extended in T012 must exist first); T002 and T003 already complete
- **Phase 6 (US4)**: Depends on Phase 3 (T012 wires session type into `onStart`)
- **Phase 7 (Polish)**: Depends on Phases 3–6

### User Story Dependencies

- **US1 (P1)**: Foundation complete → can start immediately — no dependency on US2/US3/US4
- **US2 (P2)**: Depends on US1 (extends `RehearseSession` created in T010) — independently testable once wired
- **US3 (P2)**: Depends on US1 (extends `SessionSetup` modified in T012) — can be worked in parallel with US2
- **US4 (P3)**: Depends on US1 (session type already in `onStart` after T012) — lowest priority; independently testable

### Parallel Opportunities Within Phases

**Phase 2**: T002, T003, T004 can all start in parallel; T005, T006, T007 (tests) can run in parallel with each other once their targets are implemented

**Phase 3**: T008 (`RehearseCard`), T009 (`RehearseCard.module.css`) can be done in parallel; T010 and T012 must be done sequentially (T012 modifies `SessionSetup`, T010 creates `RehearseSession`); T013 depends on both T010 and T012; T014, T015, T016 (tests) can all run in parallel once their components exist

**Phase 5**: T021 and T022 (PoS and tag multiselects) can be done in parallel; T023 depends on both; T024 can be done in parallel with T021/T022

---

## Parallel Example: Phase 3 (US1)

```
# These can start simultaneously:
T008 — RehearseCard component
T009 — RehearseCard CSS module
T011 — RehearseSession CSS module

# Once T008 is done:
T014 — RehearseCard tests

# Once T010 is done (depends on T008):
T015 — RehearseSession tests

# Once T012 is done:
T016 — SessionSetup extended tests

# Once T010 + T012 are both done:
T013 — Wire Review.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T007)
3. Complete Phase 3: US1 (T008–T016)
4. **STOP and VALIDATE**: Start rehearse session, navigate cards, confirm no score changes
5. Demo / merge MVP if ready

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 (US1) → Core rehearse session **[MVP]**
3. Phase 4 (US2) → Swipe + keyboard navigation
4. Phase 5 (US3) → PoS and tag filters
5. Phase 6 (US4) → Selection strategy options
6. Phase 7 → Polish and coverage gates

### Parallel Team Strategy (if 2 developers)

- **Dev A**: Phase 2 T002 + T003 (services), then Phase 3 T012 + T013 (SessionSetup extension + Review.tsx wiring)
- **Dev B**: Phase 2 T004 (useSwipe), then Phase 3 T008 + T010 (RehearseCard + RehearseSession)
- Merge US1 together, then split again for US2 (Dev A: keyboard) / US3 (Dev B: filters)

