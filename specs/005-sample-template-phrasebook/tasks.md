# Tasks: Sample Template Phrasebook

**Input**: Design documents from `specs/005-sample-template-phrasebook/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Total tasks**: 17
**Organization**: Grouped by user story — each phase is independently testable

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no unmet deps)
- **[Story]**: User story label — US1 through US4
- Exact file paths included in all task descriptions

---

## Phase 1: Setup

**Purpose**: Static vocabulary data module — the foundational dataset every other task depends on.

- [X] T001 Create `frontend/src/data/templatePhrasebooks.ts` with `TemplateEntry` interface, `TEMPLATE_LANGUAGE_CODES` const, `TEMPLATE_LANGUAGES` array (10 entries), and all 50 `TEMPLATE_ENTRIES` with English source, `partOfSpeech`, `tags`, `translations` for all 10 language codes (`es pt fr de it ru pl nl ro hi`), and `enrichment` (exampleSentences, synonyms, collocations) — use vocabulary table from `data-model.md` sections 5 and 4

**Checkpoint**: `npx tsc --noEmit` in `frontend/` passes. `TEMPLATE_ENTRIES.length === 50` and every entry has a `translations` key for all 10 codes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type extensions and the duplicate-prevention guard that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Add `fromTemplate?: boolean` field to `Phrasebook` interface in `api/src/models/types.ts` (after `entryCount: number` line)
- [X] T003 [P] Add `fromTemplate?: boolean` field to `DBPhrasebook` interface in `frontend/src/services/db.ts` (after `entryCount: number` line)
- [X] T004 Add duplicate language-pair check to `createPhrasebook` handler in `api/src/functions/phrasebooks.ts`: after existing validation, query `cosmosClient.queryByPartition(token.sub, { type: 'phrasebook' })`, find any result matching `sourceLanguageCode` + `targetLanguageCode`, return `apiError(409, 'You already have a phrasebook for ${sourceLanguageName} → ${targetLanguageName}.')` if found
- [X] T005 Add `generateTemplatePhrasebook(userId: string, targetCode: TemplateLanguageCode): Promise<DBPhrasebook>` to `frontend/src/services/db.ts`: (1) query existing phrasebooks for `(en, targetCode)` pair and throw a typed `DuplicateLanguagePairError` if found; (2) construct `DBPhrasebook` with `fromTemplate: true`, `sourceLanguageCode: 'en'`, `sourceLanguageName: 'English'`, `entryCount: 50`; (3) construct 50 `DBEntry` objects (from `TEMPLATE_ENTRIES`, `learningScore: 0`, `lastReviewedDate: null`) and 50 `DBEnrichment` objects; (4) write all 101 documents in a single `db.transaction('rw', [db.phrasebooks, db.entries, db.enrichments, db.pendingSync], ...)` call; (5) enqueue 101 sync mutations: `POST /api/phrasebooks` first, then 50× `POST /api/entries`, then 50× `POST /api/enrichments`; (6) return the created `DBPhrasebook`
- [X] T006 Add client-side duplicate guard to `createPhrasebook()` in `frontend/src/services/db.ts`: before `db.phrasebooks.add(data)`, query for an existing phrasebook matching `(data.userId, data.sourceLanguageCode, data.targetLanguageCode)` and throw `DuplicateLanguagePairError` if found; export the `DuplicateLanguagePairError` class from this file

**Checkpoint**: `npx tsc --noEmit` passes in both `api/` and `frontend/`. `generateTemplatePhrasebook` and `DuplicateLanguagePairError` are exported from `db.ts`.

---

## Phase 3: User Story 1 — New User Generates Starter Phrasebook (Priority: P1) 🎯 MVP

**Goal**: A new user with no phrasebooks sees a prominent "Start from a template" CTA, selects a language, generates a fully populated 50-entry phrasebook, and can immediately use it in review sessions.

**Independent Test**: Sign in with a fresh account (no phrasebooks). Visit the home/phrasebooks page. Verify the empty state has a prominent "Start from a template" button. Click it, select English → Spanish, confirm. Verify a phrasebook with exactly 50 entries appears, each with `learningScore === 0`, at least one tag, and non-empty enrichment content.

- [X] T007 [US1] Create `frontend/src/components/phrasebook/TemplatePhrasebookWizard.tsx` with props `{ onDone: (pb?: DBPhrasebook) => void; existingTargetCodes: string[] }`: render a two-column layout with (a) a static "English" source language display and (b) a 10-item target language picker using `TEMPLATE_LANGUAGES` from `templatePhrasebooks.ts`; disable options whose code appears in `existingTargetCodes` and show a tooltip "You already have an English → [Language] phrasebook"; require selection before enabling the "Generate" button; show an inline loading state while `generateTemplatePhrasebook` is in flight; call `onDone(pb)` on success, `onDone(undefined)` on cancel; handle `DuplicateLanguagePairError` by showing an inline error message without crashing
- [X] T008 [US1] Create `frontend/src/components/phrasebook/TemplatePhrasebookWizard.module.css` with styles for the wizard layout, source language display, language option buttons (default + disabled states), generate button, loading spinner, and error message
- [X] T009 [US1] Update `EmptyState` component in `frontend/src/pages/Home.tsx`: replace the single "Create your first phrasebook" button with two sibling elements — a primary "Start from a template" button (calls new `onTemplate` prop) and a secondary "Create empty phrasebook" text-link/button (calls existing `onNew` prop); add `onTemplate: () => void` to `EmptyState` props
- [X] T010 [US1] Update `Home` component in `frontend/src/pages/Home.tsx`: add `showTemplateWizard` state (boolean); compute `existingTargetCodes` from the `phrasebooks` live query (filter `sourceLanguageCode === 'en'`, map to `targetLanguageCode`); pass `onTemplate={() => setShowTemplateWizard(true)}` to `EmptyState`; render `<TemplatePhrasebookWizard>` when `showTemplateWizard === true`, passing `existingTargetCodes` and `onDone` handler that sets `showTemplateWizard(false)`

**Checkpoint**: Fresh-account empty state shows both template and empty-phrasebook options. Selecting English → Spanish generates phrasebook. All 50 entries visible in `PhrasebookView` with `learningScore 0`.

---

## Phase 4: User Story 2 — Existing User Adds a Template Phrasebook (Priority: P2)

**Goal**: A user who already has phrasebooks can access template generation from the page header, generate a template for a new language pair, and see it appear alongside existing phrasebooks without disruption.

**Independent Test**: Sign in with an account that already has one phrasebook. Locate the "From template" button in the phrasebooks page header. Click it, select English → French, generate. Verify the new phrasebook appears in the list alongside the existing one; neither phrasebook is modified.

- [X] T011 [US2] Add "From template" secondary button to the page header in `frontend/src/pages/Home.tsx` (alongside the existing "+ New Phrasebook" button): button calls `setShowTemplateWizard(true)`, styled as a secondary action (lower visual weight than "+ New Phrasebook"); button is visible at all times (not only in empty state)

**Checkpoint**: User with existing phrasebooks sees the "From template" button in the header. Generating English → French adds a second phrasebook. Both phrasebooks remain intact.

---

## Phase 5: User Story 3 — Language Selection & Duplicate Prevention (Priority: P2)

**Goal**: The language picker correctly constrains choices to 10 Indo-European languages, shows English as the fixed source, and blocks generation for any language pair the user already has — both in the wizard UI and at the service layer.

**Independent Test**: Open the template wizard. Verify exactly 10 target language options are shown. Generate English → Spanish. Re-open the wizard and verify Spanish is now disabled. Attempt to create a manual phrasebook (via `handleNewPhrasebook`) with English → Spanish and verify an error is shown.

- [X] T012 [US3] Wire `DuplicateLanguagePairError` handling into the manual phrasebook creation path in `frontend/src/pages/Home.tsx` `handleNewPhrasebook`: catch `DuplicateLanguagePairError` thrown by `createPhrasebook()` and display an inline error message ("A phrasebook for [sourceName] → [targetName] already exists") instead of silently failing
- [X] T013 [P] [US3] Add `Home.module.css` styles for the new duplicate-error inline message state

**Checkpoint**: Wizard shows exactly 10 options; already-used target codes are disabled. Manual phrasebook creation with a duplicate language pair shows an error. `npx tsc --noEmit` passes.

---

## Phase 6: User Story 4 — Template Badge & Full Phrasebook Citizenship (Priority: P3)

**Goal**: Template-generated phrasebooks display a "Starter" badge in the phrasebook card. Entries are fully editable and deletable — no lock-in.

**Independent Test**: Generate a template phrasebook. Verify its card shows a "Starter" badge. Edit one entry's `targetText`. Delete another entry. Rename the phrasebook. All three operations persist correctly.

- [X] T014 [US4] Add `fromTemplate` badge to `PhrasebookCard` in `frontend/src/pages/Home.tsx`: conditionally render `<span className={styles.templateBadge}>Starter</span>` when `phrasebook.fromTemplate === true`, placed alongside `phrasebook.name` in the card header
- [X] T015 [P] [US4] Add `.templateBadge` CSS rule to `frontend/src/pages/Home.module.css` (small pill badge, accent colour, non-interactive)

**Checkpoint**: Template phrasebook card shows "Starter" badge. Editing, deleting entries, and renaming the phrasebook all work as they do for any user-created phrasebook.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Type-check both packages, verify sync queue correctness, and validate CSS modules compile cleanly.

- [X] T016 [P] Run `npx tsc --noEmit` in `frontend/` and fix any type errors introduced by this feature (ensure `DBPhrasebook.fromTemplate`, `DuplicateLanguagePairError`, `TemplateLanguageCode` all resolve cleanly)
- [X] T017 [P] Run `npx tsc --noEmit` in `api/` and fix any type errors (ensure `Phrasebook.fromTemplate` and the new 409 guard compile cleanly)

**Checkpoint**: Both `npx tsc --noEmit` commands exit with code 0. Manual verification checklist from `quickstart.md` passes end-to-end.

---

## Dependencies

```
T001 (static data)
  └── T005, T007 (need TEMPLATE_ENTRIES / TEMPLATE_LANGUAGES)

T002 (API type)
  └── T004 (uses Phrasebook.fromTemplate in handler)

T003 (DB type)
  └── T005, T006, T007 (use DBPhrasebook.fromTemplate)

T005 (generateTemplatePhrasebook)
  └── T007 (wizard calls the service function)

T006 (duplicate guard in createPhrasebook)
  └── T012 (error handling in Home.tsx manual flow)

T007 (TemplatePhrasebookWizard component)
  └── T009, T010 (Home.tsx renders the wizard)

T009 (EmptyState update)
  └── T010 (Home wires onTemplate to EmptyState)

T010 (Home state wiring for new users)
  └── T011 (header button reuses same showTemplateWizard state)
```

## Parallel Execution Opportunities

### Phase 2 (can start in parallel after T001 completes):
- T002 (`api/src/models/types.ts`) ‖ T003 (`frontend/src/services/db.ts`) — different files

### Phase 5 (can run in parallel):
- T012 (Home.tsx error handling) ‖ T013 (Home.module.css new CSS) — different files

### Phase 6 (can run in parallel):
- T014 (badge JSX in Home.tsx) ‖ T015 (badge CSS in Home.module.css) — different files

### Phase 7 (can run in parallel):
- T016 (frontend tsc) ‖ T017 (api tsc) — independent packages

## Implementation Strategy

**MVP scope** (User Story 1 only — T001 through T010): Delivers the full new-user template generation experience. A fresh user can arrive at an empty app, generate a 50-entry Spanish phrasebook in one flow, and immediately start a review session. This is independently releasable.

**Increment 2** (add T011): Existing-user header button — zero risk, self-contained.

**Increment 3** (add T012–T013): Hardens the duplicate-prevention UX for manual phrasebook creation — complements the wizard's own duplicate guard.

**Increment 4** (add T014–T015): Template badge — purely cosmetic, zero functional risk.

**Increment 5** (T016–T017): Final type-check sweep before PR.
