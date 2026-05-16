# Implementation Plan: Unit Testing Coverage

**Branch**: `feature/007-unit-testing-coverage` | **Date**: 2026-05-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-unit-testing-coverage/spec.md`

## Summary

WordSprout has zero unit tests across its TypeScript/React frontend and Azure Functions API. This plan establishes a comprehensive unit testing suite using the already-configured Vitest toolchain, covering core business logic in both packages, enforcing minimum coverage thresholds, and updating the project's AI coding assistant instructions and constitution to mandate unit tests as a first-class contribution requirement going forward.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + API)
**Primary Dependencies**: Vitest 3.x (API), Vitest 4.x (frontend), @testing-library/react 16.x, @testing-library/user-event 14.x, @vitest/coverage-v8 (both), jsdom (frontend)
**Storage**: No new storage. Tests use in-memory test doubles (no disk I/O, no network).
**Testing**: Vitest (already configured in both packages); `@vitest/coverage-v8` for coverage; `@testing-library/react` + `@testing-library/user-event` for component tests
**Target Platform**: Node.js ≥ 20 (API tests), jsdom (frontend tests via Vitest)
**Project Type**: Web application (PWA frontend + Azure Functions API)
**Performance Goals**: Full test suite (both packages) completes in < 60 seconds on a developer machine
**Constraints**: Zero real network calls or DB I/O in any test; all external dependencies isolated via vi.mock() or interface injection
**Scale/Scope**: ~10 API test modules, ~10 frontend test modules; initial coverage targets: 80% lines/functions (API), 70% lines/functions (frontend)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with the WordSprout constitution (`.specify/memory/constitution.md`) for
each principle below. Mark ✅ compliant, ⚠ needs justification, or N/A:

- ✅ **I. Encounter-First** — No new vocabulary, features, or UI. Testing infrastructure only.
- ✅ **II. Learner Ownership** — No changes to data model or user-facing features.
- ✅ **III. Offline-First** *(NON-NEGOTIABLE)* — Tests run entirely offline; no network calls.
- ✅ **IV. AI as Assistant** — No AI calls involved. Tests mock the AI service.
- ✅ **V. Cost-Conscious** — Zero Azure resource consumption. Tests run locally and in CI with no new infrastructure.

*All constitution gates pass. No violations to track.*

## Project Structure

### Documentation (this feature)

```text
specs/007-unit-testing-coverage/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (test inventory + threshold targets)
├── quickstart.md        # Phase 1 output (how to run tests + write new ones)
├── contracts/           # Phase 1 output (no external contracts for this feature)
│   └── README.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
api/
├── src/
│   ├── utils/
│   │   └── __tests__/
│   │       └── http.test.ts               # NEW
│   ├── services/
│   │   └── __tests__/
│   │       ├── session.test.ts            # NEW
│   │       └── ai.test.ts                 # NEW
│   ├── middleware/
│   │   └── __tests__/
│   │       └── authorise.test.ts          # NEW
│   └── functions/
│       └── __tests__/
│           ├── entries.test.ts            # NEW
│           ├── auth.test.ts               # NEW
│           ├── enrich.test.ts             # NEW
│           ├── dataPortability.test.ts    # NEW
│           ├── account.test.ts            # NEW
│           └── quota.test.ts              # NEW
├── vitest.config.ts                       # MODIFY: raise thresholds (80/80/75)
└── package.json                           # No change needed

frontend/
├── src/
│   ├── utils/
│   │   └── __tests__/
│   │       └── uuid.test.ts               # NEW
│   ├── services/
│   │   └── __tests__/
│   │       ├── scoring.test.ts            # NEW (highest priority — pure functions)
│   │       ├── search.test.ts             # NEW
│   │       ├── export.test.ts             # NEW
│   │       └── sync.test.ts               # NEW
│   ├── components/
│   │   ├── review/
│   │   │   └── __tests__/
│   │   │       └── ReviewCard.test.tsx    # NEW
│   │   ├── entry/
│   │   │   └── __tests__/
│   │   │       └── EntryForm.test.tsx     # NEW
│   │   └── search/
│   │       └── __tests__/
│   │           └── SearchBar.test.tsx     # NEW
│   ├── hooks/
│   │   └── __tests__/
│   │       └── useQuota.test.tsx          # NEW
│   └── store/
│       └── __tests__/
│           └── ThemeContext.test.tsx      # NEW
├── vitest.config.ts                       # MODIFY: lower branch threshold to 65%
└── package.json                           # MODIFY: add test:coverage script

.github/
└── copilot-instructions.md                # MODIFY: add UT workflow rule

.specify/memory/
└── constitution.md                        # MODIFY: add Principle VI
```

**Structure Decision**: Option 2 (web application) — `api/` and `frontend/` as separate packages with independent test suites. Tests are co-located with source in `__tests__/` sibling directories, following Vitest idiomatic conventions.

## Complexity Tracking

*No constitution violations. No complexity to track.*

---

## Implementation Phases

### Phase A: Configuration & Infrastructure

1. Update `api/vitest.config.ts` — raise thresholds: `lines: 80, functions: 80, branches: 75`.
2. Update `frontend/vitest.config.ts` — lower branch threshold to `65%`; add `coverage.exclude` for non-testable files.
3. Add `test:coverage` script to `frontend/package.json`.

### Phase B: API Unit Tests

Implement in order (pure → higher complexity):

1. `api/src/utils/__tests__/http.test.ts` — `apiError` + `resolveId` (pure, no mocks)
2. `api/src/services/__tests__/session.test.ts` — session CRUD (mock cosmos + env)
3. `api/src/services/__tests__/ai.test.ts` — AI enrichment fetch (mock fetch + env)
4. `api/src/middleware/__tests__/authorise.test.ts` — JWT + allow-list (mock jwt, jwks-rsa, cosmos)
5. `api/src/functions/__tests__/auth.test.ts` — auth handler paths (mock cosmos + OIDC)
6. `api/src/functions/__tests__/entries.test.ts` — CRUD handlers (mock cosmos)
7. `api/src/functions/__tests__/enrich.test.ts` — enrichment handler (mock cosmos + ai)
8. `api/src/functions/__tests__/dataPortability.test.ts` — export/import (mock cosmos)
9. `api/src/functions/__tests__/account.test.ts` — account deletion (mock cosmos)
10. `api/src/functions/__tests__/quota.test.ts` — quota enforcement (mock cosmos)

### Phase C: Frontend Unit Tests

Implement in order:

1. `frontend/src/utils/__tests__/uuid.test.ts` — UUID format (pure, no mocks)
2. `frontend/src/services/__tests__/scoring.test.ts` — all pure scoring functions (highest ROI)
3. `frontend/src/services/__tests__/search.test.ts` — MiniSearch index (in-memory data)
4. `frontend/src/services/__tests__/export.test.ts` — export serialisation (mock db)
5. `frontend/src/services/__tests__/sync.test.ts` — sync queue logic (mock db + api)
6. `frontend/src/store/__tests__/ThemeContext.test.tsx` — theme context (mock localStorage)
7. `frontend/src/hooks/__tests__/useQuota.test.tsx` — quota hook (mock API)
8. `frontend/src/components/search/__tests__/SearchBar.test.tsx` — search input (RTL)
9. `frontend/src/components/entry/__tests__/EntryForm.test.tsx` — entry form (RTL)
10. `frontend/src/components/review/__tests__/ReviewCard.test.tsx` — review card (RTL)

### Phase D: Documentation & Guidelines

1. Add UT rule to `.github/copilot-instructions.md` manual additions section.
2. Add Principle VI to `.specify/memory/constitution.md` (MINOR amendment, increment version).

---

## Mock Patterns Reference

### API: Interface injection for cosmos
```ts
const mockCosmos: Partial<CosmosClientWrapper> = {
  upsert: vi.fn().mockImplementation(async (doc) => doc),
  pointRead: vi.fn().mockResolvedValue(null),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  queryByPartition: vi.fn().mockResolvedValue([]),
};
vi.mock('../../services/cosmos', () => ({ cosmosClient: mockCosmos }));
```

### API: Module mock for jwt / jwks-rsa
```ts
vi.mock('jsonwebtoken', () => ({
  default: { decode: vi.fn(), verify: vi.fn(), sign: vi.fn() }
}));
```

### Frontend: Mock Dexie db module
```ts
vi.mock('../db', () => ({
  db: {
    entries: { where: vi.fn(), toArray: vi.fn().mockResolvedValue([]) },
    enrichments: { where: vi.fn(), toArray: vi.fn().mockResolvedValue([]) },
  }
}));
```

### Frontend: Mock MSAL
```ts
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ instance: { acquireTokenSilent: vi.fn() }, accounts: [] }),
  useIsAuthenticated: () => false,
}));
```
