# Research: Unit Testing Coverage

**Feature**: 007-unit-testing-coverage
**Branch**: `feature/007-unit-testing-coverage`
**Date**: 2026-05-16

---

## 1. Test Runner & Coverage Infrastructure

### Decision
Vitest is already configured as the test runner for both packages (`api/` and `frontend/`). `@vitest/coverage-v8` is installed in both. No new test runner is needed.

### Findings
- `api/vitest.config.ts` — Node environment, `coverage.provider: 'v8'`, thresholds already set at 70% (lines/functions/branches).
- `frontend/vitest.config.ts` — jsdom environment, `@vitejs/plugin-react`, `setupFiles: ['src/test/setup.ts']`, thresholds at 70%.
- `frontend/src/test/setup.ts` — imports `@testing-library/jest-dom` (matchers already available).
- `frontend/package.json` — `@testing-library/react`, `@testing-library/user-event`, `jsdom` already installed.
- `api/package.json` — no `test:coverage` script gap; `vitest run --coverage` already wired.
- `frontend/package.json` — **missing `test:coverage` script** — needs to be added.

### Rationale
Both packages have everything needed to write and run tests. The only gap is the missing `test:coverage` script in `frontend/package.json`.

### Alternatives Considered
- Jest — rejected; project already uses Vitest which integrates natively with the Vite build pipeline.
- Playwright component tests — out of scope (E2E/integration tier, not unit tests).

---

## 2. Mocking Strategy — API (`api/`)

### Decision
Use Vitest's built-in `vi.mock()` / `vi.spyOn()` to isolate all external dependencies. Do **not** use the file-backed `cosmos.mock.ts` in unit tests (it writes to disk — unsuitable for deterministic unit tests).

### Findings
- `api/src/services/cosmos.ts` exports a `CosmosClientWrapper` interface. Tests can inject a plain object conforming to this interface as an in-memory test double — no `vi.mock()` needed for cosmos itself.
- `api/src/middleware/authorise.ts` imports `cosmosClient` (the live singleton) and calls `jwt.decode`, `jwt.verify`, JWKS clients. These must be mocked via `vi.mock('../services/cosmos')` + `vi.mock('jsonwebtoken')` + `vi.mock('jwks-rsa')`.
- `api/src/services/session.ts` — calls `cosmosClient.upsert`, `cosmosClient.queryById`. Inject a mock `CosmosClientWrapper`.
- `api/src/services/ai.ts` — calls Azure AI endpoint via fetch. Mock with `vi.stubGlobal('fetch', ...)` or inject the fetch function.
- `api/src/utils/http.ts` — `apiError` and `resolveId` are pure functions. No mocking needed.
- `api/src/functions/*.ts` — each function handler receives `(req, ctx, token)` after authentication; mock `authenticated` wrapper or test the inner handler directly by passing a fake `DecodedToken`.

### Rationale
Interface injection is more type-safe and less brittle than file-system-level mocking. Vitest's `vi.mock` provides hoisted module replacement for 3rd-party modules.

### Alternatives Considered
- `cosmos.mock.ts` in tests — rejected: it writes `.cosmos-mock.json` to disk, making tests stateful and non-deterministic.
- MSW (Mock Service Worker) — out of scope for unit tests; appropriate for integration/E2E tier.

---

## 3. Mocking Strategy — Frontend (`frontend/`)

### Decision
- **Dexie / IndexedDB**: Use `vi.mock('../services/db')` to replace all DB calls with in-memory objects. Do NOT use `fake-indexeddb` for unit tests (adds unnecessary complexity for unit-level isolation; reserved for integration tests if ever needed).
- **MSAL**: Mock `@azure/msal-react` and `@azure/msal-browser` with `vi.mock()` returning predictable account objects.
- **API service (`services/api.ts`)**: Mock entirely with `vi.mock('../services/api')` — unit tests must not make real HTTP calls.
- **`search.ts`**: Can be tested by directly building a MiniSearch index with in-memory data, without mocking Dexie (the index build is pure once entries are supplied).
- **`scoring.ts`**: Entirely pure functions — no mocking needed. High-value target for thorough parametric testing.
- **React components**: Use `@testing-library/react` + `@testing-library/user-event`. Mock context providers with minimal test wrappers.

### Rationale
Unit tests must be fast and deterministic. Dexie's IndexedDB implementation is an I/O concern, not business logic. Mocking the db module at the service boundary keeps tests isolated.

### Alternatives Considered
- `fake-indexeddb` package — considered; deferred to integration-test tier if that tier is ever introduced.
- `msw` for API mocking — out of scope for unit tests.

---

## 4. Coverage Threshold Strategy

### Decision
Raise the target thresholds to align with the spec's success criteria:
- `api/` — 80% lines, 80% functions, 75% branches (reflects high-value business logic focus).
- `frontend/` — 70% lines, 70% functions, 65% branches (wider surface area; React rendering paths make branch coverage harder to hit at launch).

Thresholds will be enforced by Vitest's built-in `coverage.thresholds` — already configured; values need updating.

### Findings
- Current thresholds: both packages at 70% across all dimensions.
- The spec target is ≥ 80% API, ≥ 70% frontend.
- Branch coverage is harder to achieve than line/function coverage; slightly lower branch threshold prevents false test-debt feeling.

### Rationale
Progressive thresholds: hit the spec target for functions/lines while being realistic about branch coverage in an initial pass. Both can be raised in a future feature.

### Alternatives Considered
- Separate thresholds per file via `coverage.thresholds.perFile` — rejected for v1; per-file thresholds add friction before any tests exist.
- 100% coverage — rejected; diminishing returns and inhibits pragmatic development.

---

## 5. Test File Conventions

### Decision
All test files live alongside their source in a `__tests__/` sibling directory, named `<module>.test.ts` (or `<Component>.test.tsx` for React). No `tests/` root directory.

**Pattern**:
```
api/src/utils/__tests__/http.test.ts
api/src/services/__tests__/session.test.ts
api/src/middleware/__tests__/authorise.test.ts
frontend/src/services/__tests__/scoring.test.ts
frontend/src/services/__tests__/search.test.ts
frontend/src/components/entry/__tests__/EntryCard.test.tsx
```

### Rationale
- Co-location with source is idiomatic for both Vitest and the React Testing Library community.
- Avoids a separate `tests/` tree that diverges from the source structure over time.
- `__tests__/` directories are Vitest-default-included and clearly signal test code.

### Alternatives Considered
- `.test.ts` files at the same level as source — simpler but creates visual clutter in component directories with many files.
- Separate root `tests/` directory — rejected; harder to maintain when source moves.

---

## 6. Copilot Instructions & Constitution Update Strategy

### Decision
Two files need updating:
1. **`.github/copilot-instructions.md`** — Add a "Testing Requirements" section under `## Workflow Rules` that mandates unit tests whenever adding new business logic or modifying existing code.
2. **`.specify/memory/constitution.md`** — Add a new principle **VI. Test Coverage as First-Class Citizen** that codifies unit testing as a mandatory project contribution requirement.

### Findings
- `.github/copilot-instructions.md` already has a `<!-- MANUAL ADDITIONS START/END -->` section under `## Workflow Rules` with one rule (run `npx tsc --noEmit`). The new UT rule will be appended there.
- Constitution currently has 5 principles (I–V). The new principle VI is additive (MINOR amendment).
- The constitution amendment procedure requires: propose → classify (MINOR) → update file + increment version + set Last Amended → propagate to templates.

### Rationale
Tooling-enforced guidelines are the most effective way to prevent future test debt. Both the AI assistant layer (copilot instructions) and the human contributor layer (constitution) must be updated for full coverage.

### Alternatives Considered
- README-only documentation — rejected; developers and AI assistants don't read READMEs before every change.
- Pre-commit hooks (Husky + lint-staged) — deferred to a future CI/CD feature; out of scope here.

---

## Summary Table

| Unknown / Question | Resolution |
|---|---|
| Is Vitest already set up? | Yes — both packages have full config and `@vitest/coverage-v8` installed |
| Are React testing utilities present? | Yes — `@testing-library/react`, `user-event`, `jest-dom`, `jsdom` all installed in frontend |
| Is there a `cosmos.mock.ts` usable in tests? | No — file-backed mock is for local dev only; create in-memory Vitest mocks instead |
| What is the test file location convention? | `__tests__/` sibling directories, `<name>.test.ts(x)` files |
| What is the threshold target? | API: 80% lines/functions, 75% branches; Frontend: 70% lines/functions, 65% branches |
| Does `frontend/package.json` have `test:coverage`? | No — must be added |
| How to update UT requirement for Copilot? | Add rule to `.github/copilot-instructions.md` manual additions section |
| How to update constitution? | Add Principle VI (MINOR amendment), increment version |
