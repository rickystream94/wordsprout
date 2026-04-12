---
description: "Task list for VocaBook MVP — Personal Vocabulary Phrasebook PWA"
---

# Tasks: VocaBook — Personal Vocabulary Phrasebook (MVP)

**Input**: Design documents from `specs/001-phrasebook-pwa-mvp/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/openapi.yaml ✅, quickstart.md ✅

**Tests**: Not included — not requested in spec.
**Organization**: Grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User story label (US1–US6)
- Paths use `frontend/` and `api/` roots per plan.md structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create both project roots with correct tooling, TypeScript config, environment
configuration system, and static assets. No business logic.

- [ ] T001 Create `frontend/` Vite + React 18 + TypeScript project scaffold (`npm create vite@latest frontend -- --template react-ts`)
- [ ] T002 Create `api/` Azure Functions Node.js v4 + TypeScript project scaffold with `host.json`, `package.json`, and `tsconfig.json`
- [ ] T003 [P] Configure ESLint + Prettier for both `frontend/` and `api/` with shared rules in repo root `.eslintrc` and `.prettierrc`
- [ ] T004 [P] Configure Vitest in `frontend/vitest.config.ts` and `api/vitest.config.ts` with coverage thresholds
- [ ] T005 Create environment configuration system: `frontend/src/config/env.ts` reads `VITE_APP_ENV` and exports typed config; `api/src/config/env.ts` reads `APP_ENV` from Function App Settings
- [ ] T006 [P] Add `frontend/public/languages.json` — bundled ISO 639-1 list (~180 entries, format: `[{ "code": "it", "name": "Italian" }]`)
- [ ] T007 [P] Add `staticwebapp.config.json` at repo root: route `/api/*` to Functions, serve SPA fallback for all other routes, enforce HTTPS

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story begins.
Includes shared types, IndexedDB schema, Cosmos DB client, authorisation middleware,
local-stage mocks, theme system, PWA scaffolding, and routing shell.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [ ] T008 Define shared TypeScript types in `api/src/models/types.ts` mirroring all entities from data-model.md: `User`, `Phrasebook`, `VocabularyEntry`, `AIEnrichment`, `AccessRequest`, `AllowList`, `SyncStatus`, `LearningState`, `PartOfSpeech`
- [ ] T009 [P] Implement Dexie.js IndexedDB schema in `frontend/src/services/db.ts`: tables for `phrasebooks`, `entries`, `enrichments`, `pendingSync`, `meta` with indexes per data-model.md
- [ ] T010 Implement Cosmos DB client + CRUD helpers in `api/src/services/cosmos.ts`: typed wrappers for point-read, upsert, delete, and cross-type query scoped to `userId` partition
- [ ] T011 Implement `authorise()` middleware in `api/src/middleware/authorise.ts`: extract Bearer token → validate with `jwks-rsa` + `jsonwebtoken` against B2C JWKS → point-read allow-list in Cosmos → return decoded claims or throw 401/403
- [ ] T012 [P] Implement local-stage mock adapters in `api/src/services/cosmos.mock.ts`: in-memory Map-based store implementing the same interface as `cosmos.ts`; selected via `APP_ENV === "local"`
- [ ] T013 [P] Implement local-stage auth bypass in `authorise.ts`: when `APP_ENV === "local"`, skip JWT validation and return hardcoded `{ userId: "test-user-local", email: "dev@local" }`
- [ ] T014 Implement typed API HTTP client in `frontend/src/services/api.ts`: fetch wrapper with Bearer token injection (from MSAL), JSON parsing, and typed error handling for 401/403/429/503
- [ ] T015 Implement sync queue in `frontend/src/services/sync.ts`: `enqueueMutation()` writes to `pendingSync` table; `replayQueue()` iterates pending ops, calls API, removes on success, increments `retryCount` on failure (max 3), marks `failed` at limit
- [ ] T016 Wire `replayQueue()` to `window.addEventListener('online', ...)` and `document.addEventListener('visibilitychange', ...)` in `frontend/src/main.tsx`
- [ ] T017 [P] Setup design token system in `frontend/src/styles/tokens.css`: CSS custom properties for colour palette (light + dark), typography scale, spacing, border radius; tokens MUST be expressive and colourful, not neutral/grey-dominant
- [ ] T018 [P] Implement `ThemeProvider` in `frontend/src/store/ThemeContext.tsx`: reads `prefers-color-scheme` as default, exposes toggle, persists choice to `localStorage`, applies `data-theme` attribute on `<html>`
- [ ] T019 [P] Create PWA Web App Manifest at `frontend/public/manifest.json`: `name`, `short_name`, `display: "standalone"`, `start_url`, `theme_color`, `background_color`, icon placeholders (192px, 512px)
- [ ] T020 [P] Configure Workbox in `frontend/vite.config.ts` via `vite-plugin-pwa`: register service worker, cache all static assets and `languages.json`, use network-first for API calls
- [ ] T021 [P] Setup React Router v6 in `frontend/src/main.tsx` with page shell `AppShell.tsx` (nav bar, offline indicator slot, sync indicator slot, theme toggle) and route stubs for all pages

**Checkpoint**: Foundation complete — all user stories can now be implemented independently.

---

## Phase 3: User Story 1 — Capture a Vocabulary Entry (Priority: P1) 🎯 MVP

**Goal**: A user can create phrasebooks and vocabulary entries entirely offline. Entries
persist through app restarts and sync to the cloud when connectivity resumes.

**Independent Test**: Disable network. Create a phrasebook (e.g., English → Italian). Add
an entry with source text "serendipity", target text "serendipità", and a note. Close and
reopen the app — entry is present. Re-enable network — entry appears in Cosmos DB.

### Implementation for User Story 1

- [ ] T022 [P] [US1] Implement Phrasebook Dexie CRUD methods in `frontend/src/services/db.ts`: `createPhrasebook()`, `getPhrasebooks()`, `updatePhrasebook()`, `deletePhrasebook()` (cascades to entries)
- [ ] T023 [P] [US1] Implement VocabularyEntry Dexie CRUD methods in `frontend/src/services/db.ts`: `createEntry()`, `getEntriesByPhrasebook()`, `updateEntry()`, `deleteEntry()`
- [ ] T024 [P] [US1] Implement `POST /phrasebooks`, `GET /phrasebooks`, `GET /phrasebooks/{id}`, `PUT /phrasebooks/{id}`, `DELETE /phrasebooks/{id}` in `api/src/functions/phrasebooks.ts`; call `authorise()` first on every handler; sanitise all text inputs with `isomorphic-dompurify`
- [ ] T025 [P] [US1] Implement `POST /entries`, `GET /entries/{id}`, `PUT /entries/{id}`, `DELETE /entries/{id}` in `api/src/functions/entries.ts`; call `authorise()` first; verify `phrasebookId` belongs to the authenticated user; sanitise all text inputs
- [ ] T026 [US1] Build `Home` page in `frontend/src/pages/Home.tsx`: list all phrasebooks as cards showing name, language pair (source → target), entry count; empty state with CTA to create first phrasebook
- [ ] T027 [US1] Build `PhrasebookForm` component in `frontend/src/components/phrasebook/PhrasebookForm.tsx`: name field + ISO 639-1 searchable dropdown for source and target language (reads `languages.json`); validates required fields
- [ ] T028 [US1] Build `PhrasebookView` page in `frontend/src/pages/PhrasebookView.tsx`: shows entry list for selected phrasebook in reverse-chronological order; FAB to add new entry
- [ ] T029 [US1] Build `EntryList` component in `frontend/src/components/entry/EntryList.tsx`: renders paginated list of `VocabularyEntry` cards showing source text, target text, learning state badge, tags
- [ ] T030 [US1] Build `EntryForm` component in `frontend/src/components/entry/EntryForm.tsx`: fields for source text, target text (optional), notes (optional); client-side sanitisation via DOMPurify before passing to service layer
- [ ] T031 [US1] Wire offline-first write path in entry/phrasebook create and update flows: write to IndexedDB first (optimistic) → `enqueueMutation()` → attempt immediate API call → on failure the queue handles retry

**Checkpoint**: US1 complete — phrasebooks and entries work fully offline. App is an independently deployable MVP.

---

## Phase 4: User Story 2 — Search and Browse Vocabulary (Priority: P2)

**Goal**: Instant offline full-text search across all phrasebooks, with combinable filters
for phrasebook, part-of-speech, tag, and learning state.

**Independent Test**: Disable network. Add 20+ entries across 2 phrasebooks. Type "serendipit" in the search bar — results appear in <1s. Apply phrasebook filter — results narrow. Apply tag filter — further narrowed. Clear filters — all entries return.

### Implementation for User Story 2

- [ ] T032 [P] [US2] Implement MiniSearch index service in `frontend/src/services/search.ts`: build `MiniSearch` document index across all entries (fields: `sourceText`, `targetText`, `notes`, `tags`); expose `search(query)` and `rebuildIndex()` functions; rebuild on DB changes
- [ ] T033 [US2] Wire index rebuild: call `rebuildIndex()` on app startup (after Dexie ready) and subscribe to Dexie live queries on `entries` table to rebuild on mutations
- [ ] T034 [P] [US2] Build `SearchBar` component in `frontend/src/components/search/SearchBar.tsx`: controlled input, debounced query dispatch (150ms), clear button
- [ ] T035 [P] [US2] Build `FilterPanel` component in `frontend/src/components/search/FilterPanel.tsx`: dropdowns/chips for phrasebook, learningState, partOfSpeech, tag; shows active filter count badge; "Clear all" action
- [ ] T036 [US2] Build `Search` page in `frontend/src/pages/Search.tsx`: combines `SearchBar` + `FilterPanel` + `EntryList`; applies MiniSearch results client-side; applies IndexedDB filter queries for filter-only (no search term) mode
- [ ] T037 [P] [US2] Implement server-side `GET /entries` with query parameters `q`, `phrasebookId`, `tag`, `partOfSpeech`, `learningState`, `limit`, `offset` in `api/src/functions/entries.ts`; scoped to authenticated user's `userId`
- [ ] T038 [P] [US2] Build `EmptyState` component in `frontend/src/components/common/EmptyState.tsx`: illustrated empty state for zero results (no entries yet vs. no search matches); suggests clearing filters when filters are active

**Checkpoint**: US2 complete — search and filtering work offline. Adding US1 + US2 delivers a fully usable offline vocabulary browser.

---

## Phase 5: User Story 3 — Sign Up and Access the App (Invite-Only) (Priority: P3)

**Goal**: Allow-listed users can sign in via OAuth and access their workspace. Non-listed
users are blocked server-side before any data is touched. Prospective users can request access.

**Independent Test**: Sign in with an allow-listed account → lands in phrasebook workspace. Sign in with a non-listed account → blocked screen with "access not granted" message, no data visible. Submit access request with an email → confirmation screen shown, record appears in Cosmos DB.

### Implementation for User Story 3

- [ ] T039 [P] [US3] Implement `GET /languages` endpoint in `api/src/functions/languages.ts`: unauthenticated, returns the ISO 639-1 language list (read from a bundled constant, no DB call); add cache headers
- [ ] T040 [US3] Implement `POST /access-requests` endpoint in `api/src/functions/accessRequests.ts`: unauthenticated; validate email format server-side; sanitise; write `AccessRequest` document to Cosmos with `userId: "_access_requests"` partition; return 202; enforce rate limit (e.g., 3 requests per IP per hour via in-memory counter in `local` stage or Azure Functions host throttling in `prod`)
- [ ] T041 [US3] Configure MSAL.js v3 in `frontend/src/auth/msalConfig.ts`: B2C tenant, policy, client ID, redirect URI from env config; export `msalInstance`
- [ ] T042 [US3] Implement `AuthProvider` in `frontend/src/auth/AuthProvider.tsx`: wraps app in `MsalProvider`, exposes `useAuth()` hook returning `{ account, login(), logout(), isAuthenticated }`
- [ ] T043 [US3] Build `Login` page in `frontend/src/pages/Login.tsx`: "Sign in with Google / Microsoft" buttons triggering MSAL redirect login; handles redirect callback
- [ ] T044 [US3] Build `RequestAccess` page in `frontend/src/pages/RequestAccess.tsx`: email input form → `POST /access-requests` → shows confirmation screen on success; inline validation for email format
- [ ] T045 [P] [US3] Build `AccessBlocked` component in `frontend/src/components/auth/AccessBlocked.tsx`: shown when API returns 403 (not on allow-list); explains invite-only status, links to access-request page
- [ ] T046 [US3] Implement auth guard in `AppShell.tsx` / router: redirect unauthenticated users to `/login`; on 403 API response redirect to `/access-blocked`; cached offline data remains accessible when session expired but online ops prompt re-auth

**Checkpoint**: US3 complete — full auth and allow-list enforcement live. App is deployable with real users.

---

## Phase 6: User Story 4 — Organise Entries with Tags and Part-of-Speech (Priority: P4)

**Goal**: Users can add free-form tags and set part-of-speech on entries. Both drive the
filter system from US2.

**Independent Test**: Open an entry. Add tags "travel" and "advanced". Save. Open FilterPanel and filter by tag "travel" — entry appears. Change tag to "always-forget" — entry leaves travel filter. Set PoS to "noun". Filter by PoS "noun" — entry appears. Change to "verb" — moves to verb filter.

### Implementation for User Story 4

- [ ] T047 [P] [US4] Build `TagInput` component in `frontend/src/components/entry/TagInput.tsx`: multi-value chip input; autocompletes from existing tags (queried from Dexie via `frontend/src/services/db.ts`); allows new free-form tags; sanitises each tag via DOMPurify; enforces max 20 tags and max 50 chars per tag
- [ ] T048 [P] [US4] Build `PartOfSpeechSelector` component in `frontend/src/components/entry/PartOfSpeechSelector.tsx`: segmented control / select showing all allowed PoS values from `types.ts`; supports null/unset state
- [ ] T049 [US4] Integrate `TagInput` and `PartOfSpeechSelector` into `EntryForm` (T030): add to create and edit flows; wire through to Dexie write + sync queue
- [ ] T050 [P] [US4] Implement `getTagSuggestions()` in `frontend/src/services/db.ts`: queries all entry `tags` arrays, deduplicates, returns sorted list for autocomplete
- [ ] T051 [P] [US4] Add tag chips and PoS badge to `EntryList` card (T029) and entry detail view

**Checkpoint**: US4 complete — tagging and PoS classification are live and feed the filter system.

---

## Phase 7: User Story 5 — Request AI Enrichment for an Entry (Priority: P5)

**Goal**: Users can trigger on-demand AI enrichment for any entry when online. Results are
editable, quota-limited, and sanitised. Offline state is visually reflected.

**Independent Test**: Open an entry, go online, click "Enrich". Within 10s enrichment appears (example sentences, synonyms, etc.). Edit a synonym — edited value persists. Open the same entry offline — enrichment still visible. Exhaust daily quota — button disabled with clear message.

### Implementation for User Story 5

- [ ] T052 [P] [US5] Implement AI proxy service in `api/src/services/ai.ts`: call Azure AI Foundry GPT-4o-mini with structured prompt (entry source text, target text, language pair); parse response into `AIEnrichment` fields; sanitise all string fields with `isomorphic-dompurify` before returning; stub in `local` stage returning fixed sample data
- [ ] T053 [US5] Implement `POST /entries/{id}/enrich` in `api/src/functions/enrich.ts`: call `authorise()`; verify entry ownership; check + increment `aiQuotaUsedToday` (reset if `aiQuotaResetAt` is past); call `ai.ts`; upsert `AIEnrichment` document; update `enrichmentId` on entry; return enrichment; return 429 with quota details when limit reached
- [ ] T054 [P] [US5] Implement `PATCH /entries/{id}/enrichment` in `api/src/functions/enrich.ts`: call `authorise()`; verify ownership; partial update enrichment fields; sanitise all incoming text; set `editedAt`
- [ ] T055 [P] [US5] Implement `GET /users/me/quota` in `api/src/functions/quota.ts`: call `authorise()`; return `{ aiQuotaUsedToday, aiQuotaLimit, aiQuotaResetAt }` from user document
- [ ] T056 [US5] Store enrichment in IndexedDB (`enrichments` table) in `frontend/src/services/db.ts`; update `entry.enrichmentId` on local record after successful enrich call
- [ ] T057 [US5] Build `EnrichmentPanel` component in `frontend/src/components/entry/EnrichmentPanel.tsx`: displays all enrichment fields (example sentences, synonyms, antonyms, register, collocations, false-friend warning) as editable inline fields; each field independently editable; calls `PATCH /entries/{id}/enrichment` on blur/save
- [ ] T058 [P] [US5] Build "Enrich" trigger button with: disabled state when offline (FR-026), loading spinner during request, 429 handling showing quota message, 503 handling with retry suggestion
- [ ] T059 [P] [US5] Build `QuotaIndicator` component in `frontend/src/components/entry/QuotaIndicator.tsx`: shows remaining enrichments today and reset time; reads from `GET /users/me/quota`

**Checkpoint**: US5 complete — AI enrichment is live, rate-limited, edit-safe, and offline-aware.

---

## Phase 8: User Story 6 — Track and Review Learning Progress (Priority: P6)

**Goal**: Users can set learning state on entries and run manual review sessions filtered
to entries in a given state.

**Independent Test**: Mark 5 entries as "learning". Navigate to Review. Filter session by "learning" state — all 5 appear. Step through each, update 2 to "mastered". Close app, reopen — 3 entries remain "learning", 2 are "mastered".

### Implementation for User Story 6

- [ ] T060 [P] [US6] Add `LearningStateToggle` component in `frontend/src/components/entry/LearningStateToggle.tsx`: segmented control (new / learning / mastered); fires `updateEntry()` → sync queue on change
- [ ] T061 [P] [US6] Integrate `LearningStateToggle` into `EntryList` card (in-place) and `EntryForm` (detail view)
- [ ] T062 [US6] Build `ReviewCard` component in `frontend/src/components/entry/ReviewCard.tsx`: shows source text (front), reveals target text + notes on tap; includes `LearningStateToggle`
- [ ] T063 [US6] Build `Review` page in `frontend/src/pages/Review.tsx`: learningState filter selection (default: "learning"); loads matching entries from Dexie; step-through navigation (prev/next); progress indicator (e.g., "3 of 12"); session exit confirmation
- [ ] T064 [US6] Wire learning-state updates in review session through offline-first path: Dexie write first → `enqueueMutation()` → sync on online; state persists across session exit

**Checkpoint**: US6 complete — full manual review loop with persistent state changes.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: PWA icon set, offline/sync indicators, dark mode completeness, responsive
audit, error boundaries, security audit, and CI secret scanning.

- [ ] T065 Create PWA icon set: `frontend/public/icons/` with 192px, 512px, and maskable 512px PNG icons expressing the app's colourful visual identity; update `manifest.json` with all icon entries including `purpose: "maskable"`
- [ ] T066 [P] Build `OfflineIndicator` component in `frontend/src/components/common/OfflineIndicator.tsx`: compact banner shown when `navigator.onLine === false`; listens to `online`/`offline` events; consistent with design language
- [ ] T067 [P] Build `SyncIndicator` component in `frontend/src/components/common/SyncIndicator.tsx`: shows pending/syncing/synced/failed count from `pendingSync` Dexie table; live Dexie subscription; tap to see details on failed items
- [ ] T068 [P] Dark mode design pass: audit all components for tokens that revert to neutral/grey in dark mode; define expressive dark-mode-specific colour overrides in `tokens.css` so dark mode reflects the same colourful identity as light mode
- [ ] T069 Responsive layout audit: test all pages at 320px (mobile), 768px (tablet), 1280px (desktop); fix any overflow, truncation, or hidden-content issues; ensure FABs and filter panels are accessible at all sizes
- [ ] T070 [P] Add React error boundaries in `frontend/src/components/common/ErrorBoundary.tsx`; wrap each page-level route with it; show friendly recovery UI rather than a blank crash screen
- [ ] T071 OWASP Top 10 security audit: review all API functions for broken access control (every endpoint calls `authorise()`), injection (sanitisation present on all text inputs and AI output), insecure design (rate limiting in place), security misconfiguration (no secrets in source, TLS enforced); document findings and fix any blocking issues
- [ ] T072 [P] Configure secret scanning: add `.gitleaks.toml` or GitHub Actions secret-scanning workflow at `.github/workflows/secret-scan.yml`; ensure `local.settings.json` and `.env.*` files are in `.gitignore`

---

## Dependencies (User Story Completion Order)

```
Phase 1 (Setup)
  └─► Phase 2 (Foundational)
        ├─► Phase 3 (US1: Entry Capture)   ← MVP — independently deliverable
        │     └─► Phase 4 (US2: Search)    ← adds search on top of US1 data
        │           └─► Phase 6 (US4: Tags/PoS)  ← extends entry model, feeds filters
        ├─► Phase 5 (US3: Auth)            ← independent; needed for prod deployment
        │
        ├─► Phase 7 (US5: AI Enrichment)   ← depends on US1 entries existing
        └─► Phase 8 (US6: Review)          ← depends on US1 entries + learning state
```

US3 (Auth) can be developed in parallel with US1–US2 since the API layer calls `authorise()`
from the start (Phase 2), and the frontend local-stage mock bypasses it entirely.

---

## Parallel Execution Examples

**While T022–T031 (US1 frontend) are in progress, these can run in parallel**:
- T039: `GET /languages` endpoint (US3, independent)
- T040: `POST /access-requests` endpoint (US3, independent)
- T034: `SearchBar` component (US2, UI only)
- T035: `FilterPanel` component (US2, UI only)

**While T053–T055 (US5 API) are in progress**:
- T057: `EnrichmentPanel` component (US5 frontend, separate file)
- T058: Enrich trigger button (US5 frontend, separate file)

---

## Implementation Strategy

**Suggested MVP scope (deliver first)**:
- Phase 1 → Phase 2 → Phase 3 (US1 only)
- At this point: offline entry capture and display is fully functional with zero Azure
  dependency (`local` stage). Demonstrates the core product value end-to-end.

**Next increment**:
- Phase 4 (US2: Search) — immediately multiplies the value of US1 data.

**Then**:
- Phase 5 (US3: Auth) — required before any `dev` or `prod` deployment.

**Then in any order**:
- Phase 6 (US4: Tags/PoS), Phase 7 (US5: AI), Phase 8 (US6: Review)

**Finally**:
- Phase 9 (Polish) — must run before first external user invitation.

---

## Summary

| Phase | User Story | Tasks | Notes |
|---|---|---|---|
| Phase 1 | Setup | T001–T007 | 7 tasks |
| Phase 2 | Foundational | T008–T021 | 14 tasks |
| Phase 3 | US1: Entry Capture (P1) | T022–T031 | 10 tasks — MVP |
| Phase 4 | US2: Search & Browse (P2) | T032–T038 | 7 tasks |
| Phase 5 | US3: Auth & Access (P3) | T039–T046 | 8 tasks |
| Phase 6 | US4: Tags & PoS (P4) | T047–T051 | 5 tasks |
| Phase 7 | US5: AI Enrichment (P5) | T052–T059 | 8 tasks |
| Phase 8 | US6: Review (P6) | T060–T064 | 5 tasks |
| Phase 9 | Polish | T065–T072 | 8 tasks |
| **Total** | | **T001–T072** | **72 tasks** |
