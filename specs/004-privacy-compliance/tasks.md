# Tasks: Privacy & Compliance

**Input**: Design documents from `specs/004-privacy-compliance/`
**Branch**: `004-privacy-compliance`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

---

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no blocking dependency on an incomplete prior task)
- **[US1/US2/US3]**: User Story label (US1 = Delete Account, US2 = Privacy Policy, US3 = Terms & Conditions)
- No label in Setup and Foundational phases

---

## Phase 1: Setup

**Purpose**: No new project initialisation is needed. This feature extends existing
`api/` and `frontend/` packages. The single setup task confirms the working environment.

- [X] T001 Run `npx tsc --noEmit` in both `api/` and `frontend/` to document any pre-existing type errors as the baseline — this feature MUST NOT introduce new type errors beyond what already exists; record any pre-existing errors before proceeding

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API and client service helpers that ALL three user stories depend on.
US1, US2, and US3 cannot be completed until T002–T005 are done.

**⚠️ CRITICAL**: Complete T002–T005 before starting any user story phase.

- [X] T002 Add `deleteAllForPartition(partitionKey: string): Promise<number>` to the `CosmosClientWrapper` interface and real implementation in `api/src/services/cosmos.ts` — query `SELECT c.id FROM c WHERE c.userId = @userId` scoped to the partition, then call `deleteItem` for each id; return count deleted
- [X] T003 Add `deleteAllForPartition` to the mock implementation in `api/src/services/cosmos.mock.ts` — iterate the in-memory store, delete all entries where `doc.userId === partitionKey`, persist the store, return count
- [X] T004 [P] Add `deleteAccount(): Promise<void>` to `frontend/src/services/api.ts` — calls `DELETE /api/account` via the existing `apiFetch` wrapper with `authenticated: true`; throws `ApiRequestError` on non-204 response
- [X] T005 [P] Add `clearLocalData(): Promise<void>` to `frontend/src/services/db.ts` — calls `Dexie.delete('wordsprout')` to drop the entire IndexedDB database; exported for use by the deletion flow

**Checkpoint**: Foundation complete — all three user story phases can now proceed

---

## Phase 3: User Story 1 — Delete Account and All Data (Priority: P1) 🎯 MVP

**Goal**: A signed-in user can permanently delete all their cloud and local data from within
the UserMenu, with a mandatory confirmation step and clear error handling if the request fails.

**Independent Test**: Sign in, create a phrasebook, open the UserMenu avatar button, click
"Delete Account", confirm the dialog — you are signed out, `.cosmos-mock.json` contains no
records for that userId, and signing in again shows an empty state.

### Implementation for User Story 1

- [X] T006 [US1] Create `DELETE /api/account` Azure Function in `api/src/functions/account.ts` — use `authenticated()` wrapper from `api/src/utils/http.ts`, call `cosmosClient.deleteAllForPartition(token.sub)`, return `{ status: 204 }` on success; handle errors with `apiError(500, 'Failed to delete account. Please try again.')`
- [X] T007 [P] [US1] Add danger-button and confirmation-dialog CSS classes to `frontend/src/components/layout/UserMenu.module.css` — `.deleteBtn` (destructive red colour, full-width), `.dialog` (modal overlay), `.dialogBox`, `.dialogTitle`, `.dialogBody`, `.dialogActions`, `.confirmBtn` (destructive), `.cancelBtn`
- [X] T008 [US1] Extend `frontend/src/components/layout/UserMenu.tsx` to add the Delete Account flow — add local state `deleteState: 'idle' | 'confirming' | 'deleting' | 'error'`; add "Delete Account" button (separated by `<hr>` from Sign Out) that sets state to `'confirming'`; render the confirmation dialog when `deleteState === 'confirming'` listing all data that will be deleted; on confirm: call `deleteAccount()` → `clearLocalData()` → `logout()` → `window.location.replace('/login')`; on API error: set `deleteState` to `'error'` and show retry option; MUST NOT clear local data or call logout if the API call fails (FR-007)
- [X] T009 [US1] Run `npx tsc --noEmit` from `api/` and `frontend/` and fix all type errors introduced in T006–T008

**Checkpoint**: US1 complete — Delete Account is fully functional and independently testable

---

## Phase 4: User Story 2 — View Privacy Policy (Priority: P2)

**Goal**: A public `/privacy` page accessible without authentication, bundled in the app
for offline access, discoverable from the app footer on all authenticated pages.

**Independent Test**: Open `http://localhost:5173/privacy` in an incognito window (not signed
in) — the Privacy Policy renders in full. Then disable network in DevTools and reload — it
still renders.

### Implementation for User Story 2

- [X] T010 [P] [US2] Create `frontend/src/pages/PrivacyPolicy.module.css` with styles for the legal page layout — `.page` (max-width container, centred), `.header` (title + date), `.backLink`, `.section` (policy section spacing), `h2`/`h3` typography, table styles for the data-collected table
- [X] T011 [US2] Create `frontend/src/pages/PrivacyPolicy.tsx` — pure presentational React component; embed the full Privacy Policy text from `spec.md` §"Privacy Policy Content" as static JSX (no fetch, no props); include a back-to-app link; use `PrivacyPolicy.module.css`
- [X] T012 [US2] Add the `/privacy` public route to `frontend/src/main.tsx` — place it **above** all `AuthenticatedRoute` and `AuthGuard` wrappers in the `<Routes>` tree so no auth check runs; import `PrivacyPolicy` page
- [X] T014 [P] [US2/US3] Add Privacy Policy and Terms & Conditions footer links to `frontend/src/pages/Login.tsx` — add a `<footer>` or `<nav>` below the sign-in card containing `<Link to="/privacy">Privacy Policy</Link>` and `<Link to="/terms">Terms & Conditions</Link>`
- [X] T015 [US2] Run `npx tsc --noEmit` from `frontend/` and fix all type errors introduced in T010–T012 and T014

**Checkpoint**: US2 complete — `/privacy` renders without auth and offline; login page shows both privacy and T&C links; AppShell footer (T013) added in Phase 5 after `/terms` route is registered

---

## Phase 5: User Story 3 — View Terms and Conditions (Priority: P3)

**Goal**: A public `/terms` page accessible without authentication, bundled in the app for
offline access, discoverable from the app footer and from the login screen.

**Independent Test**: Open `http://localhost:5173/terms` in an incognito window — the Terms
& Conditions render in full. The `/login` page shows a "Terms & Conditions" link before
signing in.

### Implementation for User Story 3

- [X] T016 [P] [US3] Create `frontend/src/pages/Terms.module.css` — can reuse the same class names as `PrivacyPolicy.module.css` (or share a common `legal-page.module.css`); `.page`, `.header`, `.backLink`, `.section`
- [X] T017 [US3] Create `frontend/src/pages/Terms.tsx` — pure presentational React component; embed the full Terms & Conditions text from `spec.md` §"Terms and Conditions Content" as static JSX; include a back-to-app link; use `Terms.module.css`
- [X] T018 [US3] Add the `/terms` public route to `frontend/src/main.tsx` — place it alongside the `/privacy` route above all auth guards; **depends on T012** (same file — T012 must be applied first to avoid conflict); import `Terms` page
- [X] T013 [US2/US3] Add a `<footer>` element to `frontend/src/components/layout/AppShell.tsx` containing links to both `/privacy` and `/terms` using react-router-dom `<Link>`; add corresponding footer styles to `frontend/src/components/layout/AppShell.module.css` (minimal sticky bottom bar) — **depends on T018**: both routes must be registered before this runs to avoid dead footer links (FR-012, FR-017)
- [X] T019 [US3] Run `npx tsc --noEmit` from `frontend/` and fix all type errors introduced in T013, T016–T018

**Checkpoint**: US3 complete — `/terms` renders without auth and offline; AppShell footer shows both Privacy Policy and T&C links (T013); login page shows both links (T014)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final integration verification, offline checks, and type safety sweep.

- [X] T020 [P] Verify `/privacy` and `/terms` on two axes: **(a) unauthenticated access** — open both URLs in an incognito window with no session and confirm the full page renders without a sign-in redirect (SC-004, FR-011, FR-016); **(b) offline availability** — load both pages while online, then disable network in DevTools → Network → Offline and reload — confirm zero network requests and full render from the bundle (SC-003, FR-014, FR-019)
- [X] T021 [P] Verify `DELETE /api/account` with a valid local token returns 204 and removes all documents from `.cosmos-mock.json` for that userId — call it twice and confirm 204 both times (idempotency)
- [X] T022 [P] Verify `DELETE /api/account` auth enforcement on two axes: **(a) missing token** — request without `Authorization` header returns 401; **(b) cross-user protection** (SC-005, FR-009) — seed `.cosmos-mock.json` with records for two distinct userIds; call `DELETE /api/account` with User A's token; confirm only User A's documents are removed and User B's documents remain intact
- [X] T023 Run `npx tsc --noEmit` from both `api/` and `frontend/` — confirm zero type errors across the full feature
- [X] T024 Review `UserMenu.tsx` deletion flow for OWASP compliance — confirm no user-supplied data is echoed unsanitised in the confirmation dialog; confirm the delete button is not triggerable without the explicit confirm action (FR-003)

---

## Dependencies

```
T001 (baseline)
  └── T002 (Cosmos interface + real impl)
        └── T003 (Cosmos mock impl)
              └── T006 [US1] (API function — needs T002/T003)
                    └── T007 [US1] (CSS — parallel with T006)
                          └── T008 [US1] (UserMenu — needs T004, T005, T006, T007)
                                └── T009 [US1] (tsc check)

T004 [foundational] (deleteAccount API client — parallel with T002/T003)
T005 [foundational] (clearLocalData — parallel with T002/T003)

T010 [US2] (PrivacyPolicy CSS — parallel)
  └── T011 [US2] (PrivacyPolicy component — needs T010)
        └── T012 [US2] (route registration — needs T011)
              └── T014 [US2/US3] (Login footer links — independent file, parallel with T012)
                    └── T015 [US2] (tsc check — covers T010–T012, T014)

T016 [US3] (Terms CSS — parallel with T010)
  └── T017 [US3] (Terms component — needs T016)
        └── T018 [US3] (route registration — needs T012 + T017; same main.tsx as T012)
              └── T013 [US2/US3] (AppShell footer — needs T012 + T018: both routes must exist first)
                    └── T019 [US3] (tsc check — covers T013, T016–T018)

T020–T024 (Polish — all need T001–T019 complete)
```

## Parallel Execution Opportunities

**After T001:**
- T002 and T004 and T005 can start simultaneously (different files)
- T003 can start as soon as T002 is done (same file, different method)
- T010 and T016 can start simultaneously (different files)

**After T002–T005:**
- T006, T010, T016 can all start simultaneously (different files)
- T007 can run alongside T006
- T014 is independent of all US1 tasks (Login.tsx only — can start any time after Phase 2)

**After T012 (main.tsx `/privacy` route registered):**
- T018 must follow T012 (same `main.tsx` file — cannot edit concurrently)
- T013 (AppShell footer) must follow both T012 and T018 to avoid dead links

**US2 and US3 are fully independent of US1** — they can be implemented in parallel after
the foundational phase, since they touch different files.

## Implementation Strategy

**Recommended MVP scope**: US1 alone (T001–T009) delivers the highest-value, legally-required
feature. US2 and US3 can follow in immediate succession as they are low-complexity page additions.

**Suggested order**:
1. T001 (verify baseline)
2. T002, T003, T004, T005 in parallel (foundation)
3. T006, T007 in parallel → T008 → T009 (US1 complete)
4. T010, T014, T016 in parallel → T011, T017 → T012 → T018 → T013 → T015, T019 in parallel (US2+US3)
5. T020–T024 (polish)

**Total tasks**: 24
**US1 tasks**: 4 implementation + 1 tsc check = 5 (T006–T009, plus foundational T002–T005)
**US2 tasks**: T010–T012, T014, T015 = 5
**US3 tasks**: T016–T019, T013 (moved from Phase 4) = 5
**Foundational tasks**: 4 (T002–T005)
**Polish tasks**: 5 (T020–T024)
