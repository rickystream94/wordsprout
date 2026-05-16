# Tasks: Unit Testing Coverage

**Input**: Design documents from `specs/007-unit-testing-coverage/`
**Branch**: `feature/007-unit-testing-coverage`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on other in-progress tasks)
- **[Story]**: User story label — US1 = API tests, US2 = Frontend tests, US3 = Threshold enforcement, US4 = AI/constitution guidelines
- Exact file paths are included in every task description

---

## Phase 1: Setup (Configuration & Infrastructure)

**Purpose**: Update Vitest configs and package scripts before any test files are written. These changes define what "passing coverage" means and unblock all subsequent work.

- [X] T001 Update `api/vitest.config.ts` — raise coverage thresholds to `lines: 80, functions: 80, branches: 75` and add `coverage.include: ['src/**']`
- [X] T002 Update `frontend/vitest.config.ts` — set `branches: 65` (lines/functions stay 70) and add `coverage.exclude` for `src/main.tsx`, `src/test/**`, `**/*.d.ts`
- [X] T003 Add `"test:coverage": "vitest run --coverage"` script to `frontend/package.json`

**Checkpoint**: Running `npm run test:coverage` in both packages produces coverage reports (0% initially) and exits non-zero until tests are written.

---

## Phase 2: Foundational (Shared Test Infrastructure)

**Purpose**: Establish mock helper patterns used across all API tests. Must exist before any API test file can import them.

- [X] T004 Create `api/src/__mocks__/cosmos.ts` — in-memory `CosmosClientWrapper` test factory that returns a `vi.fn()`-backed implementation with no file I/O, used as the shared cosmos mock across all API tests
- [X] T005 [P] Create `api/src/__mocks__/env.ts` — vi.mock-compatible env stub exporting all constants from `api/src/config/env.ts` with safe test defaults (no real secrets)

**Checkpoint**: Mock helpers exist and can be imported by Phase 3 test files.

---

## Phase 3: User Story 1 — API Business Logic Test Suite (Priority: P1) 🎯 MVP

**Goal**: Full unit test coverage of all API services, utilities, middleware, and function handlers. Each function's happy path, error path, and key edge cases are covered. Running `npm run test:coverage` in `api/` passes with all thresholds met.

**Independent Test**: `cd api && npm run test:coverage` passes with ≥80% lines, ≥80% functions, ≥75% branches and prints a per-file coverage table.

- [X] T006 [P] [US1] Create `api/src/utils/__tests__/http.test.ts`
- [X] T007 [P] [US1] Create `api/src/services/__tests__/session.test.ts`
- [X] T008 [P] [US1] Create `api/src/services/__tests__/ai.test.ts`
- [X] T009 [US1] Create `api/src/middleware/__tests__/authorise.test.ts`
- [X] T010 [P] [US1] Create `api/src/functions/__tests__/auth.test.ts`
- [X] T011 [P] [US1] Create `api/src/functions/__tests__/entries.test.ts`
- [X] T012 [P] [US1] Create `api/src/functions/__tests__/enrich.test.ts`
- [X] T013 [P] [US1] Create `api/src/functions/__tests__/dataPortability.test.ts`
- [X] T014 [P] [US1] Create `api/src/functions/__tests__/account.test.ts`
- [X] T015 [P] [US1] Create `api/src/functions/__tests__/quota.test.ts`

**Checkpoint**: `cd api && npm run test:coverage` green with ≥80% lines/functions, ≥75% branches.

---

## Phase 4: User Story 2 — Frontend UI & Service Test Suite (Priority: P2)

**Goal**: Unit test coverage of all core frontend services, utilities, hooks, and key components. Running `npm run test:coverage` in `frontend/` passes with all thresholds met.

**Independent Test**: `cd frontend && npm run test:coverage` passes with ≥70% lines, ≥70% functions, ≥65% branches and prints a per-file coverage table.

- [X] T016 [P] [US2] Create `frontend/src/utils/__tests__/uuid.test.ts`
- [X] T017 [P] [US2] Create `frontend/src/services/__tests__/scoring.test.ts`
- [X] T018 [P] [US2] Create `frontend/src/services/__tests__/search.test.ts`
- [X] T019 [P] [US2] Create `frontend/src/services/__tests__/export.test.ts`
- [X] T020 [P] [US2] Create `frontend/src/services/__tests__/sync.test.ts`
- [X] T021 [P] [US2] Create `frontend/src/store/__tests__/ThemeContext.test.tsx`
- [X] T022 [P] [US2] Create `frontend/src/hooks/__tests__/useQuota.test.tsx`
- [X] T023 [P] [US2] Create `frontend/src/components/search/__tests__/SearchBar.test.tsx`
- [X] T024 [P] [US2] Create `frontend/src/components/entry/__tests__/ReviewCard.test.tsx`
- [ ] T025 [US2] Create `frontend/src/components/entry/__tests__/EntryForm.test.tsx`

**Checkpoint**: `cd frontend && npm run test:coverage` green with ≥70% lines/functions, ≥65% branches.

---

## Phase 5: User Story 3 — Coverage Threshold Enforcement (Priority: P3)

**Goal**: Both packages' coverage thresholds are correctly configured, enforced, and wired into CI. A PR that drops coverage below threshold is automatically blocked.

**Independent Test**: Temporarily lower one threshold value below the actual coverage and confirm `npm run test:coverage` exits with a non-zero code and a descriptive error message.

- [X] T026 [US3] Verify `api/vitest.config.ts` thresholds — `npm run test:coverage` in `api/` exits 0 ✅
- [X] T027 [US3] Verify `frontend/vitest.config.ts` thresholds — `npm run test:coverage` in `frontend/` exits 0 ✅
- [X] T028 [P] [US3] Update `.github/workflows/ci.yml` — replaced `npm test` with `npm run test:coverage` for both Frontend and API test steps

**Checkpoint**: `ci.yml` runs coverage-enabled tests; a deliberate threshold breach causes the CI job to fail.

---

## Phase 6: User Story 4 — AI Coding Assistant UT Guidelines (Priority: P4)

**Goal**: The AI coding assistant instructions and the project constitution both mandate unit tests for all new business logic and core UI changes.

**Independent Test**: Ask the AI assistant to implement a new service function without mentioning tests — it must proactively generate a corresponding `__tests__/` file.

- [X] T029 [US4] Update `.github/copilot-instructions.md` — added UT mandate rule in `<!-- MANUAL ADDITIONS START/END -->` block
- [X] T030 [US4] Update `.specify/memory/constitution.md` — added Principle VI Test Coverage as First-Class Citizen; bumped to v1.1.0

**Checkpoint**: `.github/copilot-instructions.md` contains the UT rule; constitution has Principle VI and an updated version number.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, consistency checks, and ensuring the quickstart guide matches reality.

- [X] T031 [P] Run `cd api && npm run test:coverage` — 84 tests pass, thresholds met ✅
- [X] T032 [P] Run `cd frontend && npm run test:coverage` — 119 tests pass, thresholds met ✅
- [X] T033 [P] Run `npx tsc --noEmit` in both packages — zero type errors ✅
- [ ] T034 Validate `specs/007-unit-testing-coverage/quickstart.md` commands against final state of `package.json` scripts and `vitest.config.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (config must be in place before writing tests)
- **Phase 3 (US1 — API)**: Depends on Phase 2 (cosmos + env mocks must exist)
- **Phase 4 (US2 — Frontend)**: Depends on Phase 1 only (independent of API tests)
- **Phase 5 (US3 — Thresholds)**: Depends on Phases 3 and 4 (thresholds only pass once tests exist)
- **Phase 6 (US4 — Guidelines)**: Depends on Phase 1 (config baseline must be final); independent of test file creation
- **Phase 7 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (API tests)**: Requires Phase 2 mocks. T006–T008 can all start in parallel once T004–T005 done.
- **US2 (Frontend tests)**: Requires Phase 1 only. T016–T024 can all start in parallel.
- **US3 (Thresholds)**: T026/T027 verify config from Phase 1; T028 (CI update) can run any time after Phase 1.
- **US4 (Guidelines)**: T029/T030 are independent of all test file work — can be done in parallel with Phase 3/4.

### Parallel Opportunities Per Story

**US1 — API tests** (after T004/T005 complete):
- T006, T007, T008 can run in parallel (separate files, no inter-dependency)
- T009 depends on T007 mock patterns being understood (sequence recommended)
- T010–T015 can all run in parallel once T009 is done (each covers a separate function file)

**US2 — Frontend tests** (after Phase 1):
- T016, T017, T018 are pure function tests — fully parallel, no mocks needed
- T019, T020 require db mock setup — can be written in parallel with each other
- T021, T022 require context/hook wrappers — parallel with each other
- T023, T024, T025 are component tests — fully parallel with each other

---

## Parallel Example: User Story 2 (Frontend)

```bash
# Terminal 1 — pure service tests (no mocks)
cd frontend
# Work on T017 (scoring.test.ts) and T018 (search.test.ts) simultaneously

# Terminal 2 — mocked service tests
# Work on T019 (export.test.ts) and T020 (sync.test.ts) simultaneously

# Terminal 3 — component + hook tests
# Work on T021-T025 simultaneously

# When all done:
npm run test:coverage
```

---

## Implementation Strategy

**MVP scope** (deliver US1 + US3 CI wire-up first):
1. Phase 1 (T001–T003) — 30 min
2. Phase 2 (T004–T005) — 30 min
3. Phase 3 (T006–T015) — core API test suite — ~3–4 hours
4. Phase 5 T028 only (CI update) — 20 min

This MVP gives immediate regression protection on the highest-risk code (API business logic) and blocks future PRs from regressing coverage.

**Full delivery**:
Add Phases 4, 6, and 7 on top of the MVP to complete frontend coverage and lock in the AI assistant guidelines.
