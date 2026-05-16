# Tasks: Data Export & Import

**Input**: Design documents from `specs/006-data-export-import/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Total tasks**: 16
**Organization**: Grouped by user story — each phase is independently testable

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no unmet dependencies)
- **[Story]**: User story label — US1 through US3
- Exact file paths included in all task descriptions

---

## Phase 1: Setup

**Purpose**: Skeleton files and routing scaffolding that both US1 and US2 depend on.

- [X] T001 [P] Create `frontend/src/pages/Settings.tsx` skeleton: authenticated page component exporting `default function Settings()`; render a `<div className={styles.page}>` containing an `<h1>Settings</h1>` and a `<section className={styles.section}>` with `<h2 className={styles.sectionTitle}>Account Data</h2>` and a `<p className={styles.description}>` placeholder; import `styles` from `./Settings.module.css`; do not add any export or import functionality yet
- [X] T002 [P] Create `frontend/src/pages/Settings.module.css` with base layout classes: `.page` (max-width 640px, margin auto, padding), `.section` (margin-block), `.sectionTitle` (font-weight bold, margin-bottom), `.description` (color muted, margin-bottom), `.actions` (display flex, gap, flex-wrap wrap), `.statusMessage` (inline success/error feedback text), `.confirmOverlay` and `.confirmDialog` for the import confirmation modal
- [X] T003 Add `/settings` protected route to `frontend/src/main.tsx`: inside the existing `<Route element={<AuthGuard />}><Route element={<AppShell />}>` group, add `<Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />`; add the import `import Settings from './pages/Settings'` alongside the other page imports
- [X] T004 Add "Settings" navigation link to the `UserMenu` dropdown in `frontend/src/components/layout/UserMenu.tsx`: import `Link` from `react-router-dom` (if not already imported); after the "Manage tags" `<button>` element and its following `<hr>`, add a `<Link to="/settings" className={styles.signOutBtn} role="menuitem" onClick={() => setOpen(false)}>Settings</Link>` element; add a new `<hr className={styles.separator} />` before the existing "Delete account" section to visually separate it from the new Settings link

**Checkpoint**: `npm run dev` starts without errors. Navigating to `/settings` renders a page with "Settings" heading and "Account Data" section. The UserMenu dropdown shows a "Settings" link that navigates to `/settings`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type definitions and IndexedDB helpers required by both US1 (export) and US2 (import).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Extend `api/src/models/types.ts` with export/import types: (1) add `ExportPhrasebook` interface (mandatory: `id`, `name`, `sourceLanguageCode`, `targetLanguageCode`, `createdAt`, `updatedAt`; optional: `sourceLanguageName?`, `targetLanguageName?`, `entryCount?`, `fromTemplate?`); (2) add `ExportEntry` interface (mandatory: `id`, `phrasebookId`, `sourceText`, `createdAt`, `updatedAt`; optional: `targetText?`, `notes?`, `tags: string[]`, `partOfSpeech?`, `learningScore?`, `lastReviewedDate?`, `enrichmentId?`); (3) add `ExportEnrichment` interface (mandatory: `id`, `entryId`, `createdAt`, `updatedAt`; optional: all content fields from `AIEnrichment`); (4) add `ExportData` interface (`phrasebooks: ExportPhrasebook[]`, `entries: ExportEntry[]`, `enrichments: ExportEnrichment[]`); (5) add `ExportPackage` interface (`schemaVersion: 1`, `app: 'wordsprout'`, `exportedAt: string`, `data: ExportData`); (6) add `ImportResult` interface (`phrasebooksImported: number`, `entriesImported: number`, `enrichmentsImported: number`, `phrasebooks: Phrasebook[]`, `entries: VocabularyEntry[]`, `enrichments: AIEnrichment[]`); (7) add `lastImportAt?: string` to the `User` interface after the `aiDailyEnrichmentLimit` field
- [X] T006 [P] Add `clearUserContent(userId: string): Promise<void>` and `bulkRestoreFromExport(phrasebooks: DBPhrasebook[], entries: DBEntry[], enrichments: DBEnrichment[]): Promise<void>` to `frontend/src/services/db.ts`: `clearUserContent` clears all records matching the given userId from `phrasebooks`, `entries`, `enrichments` tables AND clears all records from `pendingSync` — all inside a single `db.transaction('rw', [db.phrasebooks, db.entries, db.enrichments, db.pendingSync], async () => { ... })`; `bulkRestoreFromExport` calls `db.phrasebooks.bulkPut(phrasebooks)`, `db.entries.bulkPut(entries)`, `db.enrichments.bulkPut(enrichments)` inside a single `'rw'` transaction — both functions exported

**Checkpoint**: `npx tsc --noEmit` in `api/` and `frontend/` both pass. `clearUserContent` and `bulkRestoreFromExport` are exported from `db.ts`.

---

## Phase 3: User Story 1 — Export All Data (Priority: P1) 🎯 MVP

**Goal**: An authenticated user can download a complete backup of all their phrasebooks, entries, and enrichments as a versioned JSON file. Works offline.

**Independent Test**: Sign in with an account containing multiple phrasebooks and entries. Navigate to `/settings`. Click "Export my data". A file named `wordsprout-backup-YYYY-MM-DD.json` is downloaded. Open it: verify `schemaVersion` is `1`, `app` is `"wordsprout"`, and the arrays contain the user's data. Set the browser to offline mode (DevTools → Network → Offline) and repeat — the export should still succeed.

- [X] T007 [US1] Create `frontend/src/services/export.ts` with two exported functions: (1) `generateExportPackage(userId: string): Promise<ExportPackage>` — in parallel via `Promise.all`, reads all phrasebooks (`db.phrasebooks.where('userId').equals(userId).toArray()`), entries (`db.entries.where('userId').equals(userId).toArray()`), enrichments (`db.enrichments.where('userId').equals(userId).toArray()`); maps each record to its Export type by omitting the `userId` field (entries and phrasebooks also omit any runtime-only fields not in the Export interfaces); returns `{ schemaVersion: 1, app: 'wordsprout', exportedAt: new Date().toISOString(), data: { phrasebooks, entries, enrichments } }`; (2) `triggerDownload(pkg: ExportPackage): void` — JSON-stringifies `pkg`; creates `new Blob([json], { type: 'application/json' })`; constructs the filename as `wordsprout-backup-${new Date().toLocaleDateString('en-CA')}.json` (ISO date, locale-independent); creates an `<a>` element, sets `href = URL.createObjectURL(blob)` and `download = filename`; appends it to `document.body`, calls `.click()`, then calls `document.body.removeChild(a)` and `URL.revokeObjectURL(href)` — this append/remove pattern is required for Safari iOS compatibility; import `ExportPackage` from the type defined in `frontend/src/types/models.ts` (or define the type locally if the frontend types file is not suitable)
- [X] T008 [US1] Add Export section to `frontend/src/pages/Settings.tsx`: import `generateExportPackage` and `triggerDownload` from `../services/export`; import `pullFromServer` from `../services/sync`; import `useAuth` from `../auth/useAuth` to get the current `userId`; add an `isExporting` state; render a "Export my data" `<button>` (disabled while exporting) inside the `<section>`; button click handler: (1) `setIsExporting(true)`; (2) if `navigator.onLine`, await `Promise.race([pullFromServer(), new Promise(res => setTimeout(res, 5000))])` (best-effort 5-second timeout — do NOT re-throw on failure); (3) `const pkg = await generateExportPackage(userId)`; (4) `triggerDownload(pkg)`; (5) `setIsExporting(false)` and set a success status message "Your data has been exported successfully"; wrap all in try/catch to set an error status message on failure; render the status message in a `<p className={styles.statusMessage}>`

**Checkpoint**: Navigate to `/settings`. Click "Export my data". A file `wordsprout-backup-<today>.json` is downloaded. Inspecting the file shows `schemaVersion: 1`, `app: 'wordsprout'`, and all user data. DevTools offline mode: export still works.

---

## Phase 4: User Story 2 — Import Data / Restore (Priority: P2)

**Goal**: An authenticated user can restore their data from a previously exported backup file. Invalid, malicious, or oversized files are rejected before any data is written.

**Independent Test**: Use the export file from the US1 checkpoint. Navigate to `/settings` → Import section. Select the file. Confirm. Verify success summary shows correct counts. Verify data is fully restored in the app. Then test each of the 9 security scenarios in `quickstart.md` section 3 — every bad file is rejected with a clear error message and no data is modified.

- [X] T009 [US2] Add `validateImportFile(file: File): Promise<ValidatedImportFile>` to `frontend/src/services/export.ts` where `ValidatedImportFile` is the union type `{ valid: true; pkg: ExportPackage; summary: { phrasebooks: number; entries: number } } | { valid: false; error: string }`; implement all 7 client-side checks in order per `data-model.md` section 3.1: (1) `!file.name.endsWith('.json') && file.type !== 'application/json' && file.type !== 'text/plain'` → `"Only JSON files are accepted"`; (2) `file.size > 10 * 1024 * 1024` → `"File is too large (maximum 10 MB)"`; (3) `JSON.parse(await file.text())` in try/catch → `"File is not valid JSON"`; (4) missing top-level keys `schemaVersion`, `app`, `exportedAt`, `data` → `"File does not appear to be a WordSprout backup"`; (5) `parsed.schemaVersion !== 1` → `"This backup was created with a newer version of WordSprout. Please update the app and try again."`; (6) `parsed.app !== 'wordsprout'` → `"File does not appear to be a WordSprout backup"`; (7) `!Array.isArray(parsed.data?.phrasebooks) || !Array.isArray(parsed.data?.entries)` → `"Backup file has an unexpected structure"`; on success return `{ valid: true, pkg: parsed as ExportPackage, summary: { phrasebooks: parsed.data.phrasebooks.length, entries: parsed.data.entries.length } }`
- [X] T010 [P] [US2] Add `importData(pkg: ExportPackage): Promise<ImportResult>` to `frontend/src/services/api.ts`: call `apiFetch<ImportResult>('/data/import', { method: 'POST', body: JSON.stringify(pkg) })`; place it after the existing `deleteAccount` function; import `ExportPackage` and `ImportResult` types
- [X] T011 [US2] Create `api/src/functions/dataPortability.ts`: implement a single POST handler registered as `app.http('data-import', { methods: ['POST'], route: 'data/import', authLevel: 'anonymous', handler: authenticated(importData) })`; implement `importData` following the 9-step processing order from `contracts/api.md`: step 1 — parse `Content-Length` header as integer; if > `10 * 1024 * 1024` return `apiError(413, 'Request body exceeds the maximum allowed size of 10 MB')`; step 2 — `await req.json()` in try/catch, return `apiError(400, 'Request body is not valid JSON')` on failure; step 3 — validate: required top-level keys, `schemaVersion === 1`, `app === 'wordsprout'`, each phrasebook has non-empty `name`/`sourceLanguageCode`/`targetLanguageCode`, each entry has non-empty `sourceText` and `phrasebookId`, every `entry.phrasebookId` matches a phrasebook id in the package — return appropriate 422 errors from `data-model.md` section 3.2 on failure; step 4 — `cosmosClient.pointRead<User>(token.sub, token.sub)`; if `user?.lastImportAt` exists and `Date.now() - new Date(user.lastImportAt).getTime() < 5 * 60 * 1000` return `apiError(429, 'Import rate limit exceeded. Please wait 5 minutes before importing again.')`; step 5 — sanitise all string fields with `DOMPurify.sanitize(value).trim()` per `data-model.md` section 3.3; step 6 — query all type-`phrasebook`, type-`entry`, and type-`enrichment` docs via `cosmosClient.queryByPartition` in three calls; delete each with `cosmosClient.deleteItem`; step 7 — upsert all phrasebooks/entries/enrichments with `userId = token.sub` and correct `type` field values using `cosmosClient.upsert`; for enrichments, silently skip any whose `entryId` does not appear in an imported entry; recalculate `entryCount` on each phrasebook from actual imported entries; step 8 — upsert User document with `lastImportAt = new Date().toISOString()`; step 9 — return `{ status: 200, jsonBody: { phrasebooksImported: N, entriesImported: M, enrichmentsImported: K, phrasebooks: [...], entries: [...], enrichments: [...] } }`; import `DOMPurify` from `isomorphic-dompurify`, `authenticated` + `apiError` + `resolveId` from `../utils/http`, `cosmosClient` from `../services/cosmos`, all relevant types from `../models/types`
- [X] T012 [US2] Add Import section to `frontend/src/pages/Settings.tsx`: import `validateImportFile`, `ExportPackage` from `../services/export`; import `importData` from `../services/api`; import `clearUserContent`, `bulkRestoreFromExport` from `../services/db`; import `rebuildIndex` from `../services/search`; add state: `importStatus: 'idle' | 'validating' | 'confirming' | 'importing' | 'done' | 'error'`, `importError: string | null`, `importSummary: { phrasebooks: number; entries: number } | null`, `pendingPkg: ExportPackage | null`, `fileInputRef: React.useRef<HTMLInputElement>`; render a "Import data" `<button>` that calls `fileInputRef.current?.click()` (disabled while importing); render a hidden `<input type="file" ref={fileInputRef} accept=".json" style={{ display: 'none' }} onChange={handleFileSelect}>`; `handleFileSelect` calls `validateImportFile(file)`, on invalid file sets error state, on valid sets `importStatus: 'confirming'` and stores `pendingPkg`; render a confirmation modal/dialog when `importStatus === 'confirming'`: show "This will replace all your current data with N phrasebooks and M entries. This cannot be undone." with a Confirm and a Cancel button; on Confirm: call `importData(pendingPkg)`, on success call `clearUserContent(userId)` then `bulkRestoreFromExport(result.phrasebooks as DBPhrasebook[], result.entries as DBEntry[], result.enrichments as DBEnrichment[])` then `rebuildIndex()`, set `importStatus: 'done'` and `importSummary`; on API error extract the message from `ApiRequestError` and set `importStatus: 'error'`, `importError`; do NOT call `clearUserContent` or `bulkRestoreFromExport` on any error path; render success summary "Imported N phrasebooks and M entries" when done; render error message when in error state; reset file input value after every attempt

**Checkpoint**: Full import flow works end-to-end. All 9 security scenarios from `quickstart.md` section 3 pass (bad files rejected client-side or server-side with clear messages, no IndexedDB modification on failure). Rate limit (scenario 3g) returns 429 after a recent import.

---

## Phase 5: User Story 3 — Cross-Device & Cross-Browser Portability (Priority: P3)

**Goal**: Confirm the export/import implementation is platform-agnostic by verifying it uses only standard browser APIs. No new code is added — this phase is a verification and hardening pass.

**Independent Test**: Export on Chrome desktop → import on Safari mobile (follow `quickstart.md` section 4).

- [X] T013 [US3] Review `frontend/src/services/export.ts` for platform-agnosticism: (1) confirm no Node.js `fs`, `path`, `os`, or `child_process` imports exist; (2) confirm `triggerDownload()` uses `document.body.appendChild(a)` / `a.click()` / `document.body.removeChild(a)` — this pattern is required for Safari iOS (which does not fire click events on detached anchors); (3) confirm the `<input type="file">` rendered in `Settings.tsx` does NOT have a `capture` attribute (which would restrict file selection to camera on mobile); (4) confirm `file.text()` is used to read file content (universally supported); if any of these checks fail, make the necessary corrections in the appropriate files

**Checkpoint**: Follow `quickstart.md` section 4. Export on Chrome, import on Safari. All data is restored without errors.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: TypeScript validation and end-to-end quickstart walkthrough.

- [X] T014 [P] Run `npx tsc --noEmit` from `api/` directory; fix all TypeScript errors in `api/src/models/types.ts` and `api/src/functions/dataPortability.ts` (ensure `ExportPackage` and `ImportResult` types are used correctly throughout; verify `DOMPurify` import compiles correctly)
- [X] T015 [P] Run `npx tsc --noEmit` from `frontend/` directory; fix all TypeScript errors across all modified and new files: `frontend/src/services/export.ts`, `frontend/src/services/db.ts`, `frontend/src/services/api.ts`, `frontend/src/pages/Settings.tsx`, `frontend/src/main.tsx`, `frontend/src/components/layout/UserMenu.tsx`
- [X] T016 Follow `quickstart.md` end-to-end: run all sections including the 9 security validation scenarios (section 3) and the cross-device scenario (section 4); fix any issues discovered; confirm all acceptance scenarios from `spec.md` are met; record export and import times and confirm SC-001 (export < 10 s) and SC-002 (import < 30 s) are met

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: No dependencies on Phase 1 — can run in parallel with Phase 1
- **Phase 3 (US1)**: Requires Phase 1 AND Phase 2 to be complete
- **Phase 4 (US2)**: Requires Phase 1, Phase 2, AND T007 (export.ts must exist before adding to it in T009)
- **Phase 5 (US3)**: Requires Phase 3 (T007) and Phase 4 (T009) to be complete
- **Phase 6 (Polish)**: Requires all previous phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 1 + Phase 2. No dependency on US2 or US3.
- **US2 (P2)**: Depends on Phase 1 + Phase 2 + T007 (T009 adds to the file T007 creates)
- **US3 (P3)**: Depends on US1 + US2 being complete (verification pass only)

### Within User Story 2

- T009 (validateImportFile) depends on T007 (export.ts must exist first) — sequential on same file
- T010 (importData in api.ts) is independent of T009 — can run in parallel
- T011 (server handler) is independent of T009 and T010 — can run in parallel with both
- T012 (Settings import UI) depends on T009, T010, T011 all being complete

### Parallel Opportunities Per Phase

- **Phase 1**: T001 ‖ T002 (different files); T003 and T004 depend on T001 existing but can run in parallel with each other
- **Phase 2**: T005 ‖ T006 (different files)
- **Phase 4**: T009 → T011 sequential (same file); T010 ‖ T011 (different files)
- **Phase 6**: T014 ‖ T015 (different projects)

---

## Parallel Execution Example: Phase 4

```
Start Phase 4:
├─ T009: Add validateImportFile() to export.ts    [sequential after T007]
├─ T010: Add importData() to api.ts               [parallel — different file]
└─ T011: Create dataPortability.ts (API handler)  [parallel — different file]

Once T009 + T010 + T011 are done:
└─ T012: Add Import UI to Settings.tsx            [depends on all three above]
```

---

## Implementation Strategy

### MVP Scope (just US1)
Complete Phases 1, 2, and 3 (T001–T008): users can export their data. The Settings page exists with a working Export section. Import is not yet available but can be added independently.

### Full Feature
Complete all phases. US2 (import) is the most complex — the API handler (T011) is the highest-risk task and should be implemented and manually tested before wiring the UI (T012).

### Suggested Order for Solo Implementation
Phase 1 → Phase 2 → Phase 3 → Phase 4 (T011 first, then T009, T010, then T012) → Phase 5 → Phase 6
