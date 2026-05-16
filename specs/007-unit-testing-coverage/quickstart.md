# Quickstart: Unit Testing Coverage

**Feature**: 007-unit-testing-coverage
**Branch**: `feature/007-unit-testing-coverage`
**Date**: 2026-05-16

---

## Prerequisites

- Node.js ≥ 20 and npm installed
- Dependencies installed in both packages (`npm install` inside `api/` and `frontend/`)
- No external services or environment variables required — all tests run fully offline

---

## Running the Tests

### API test suite

```bash
# From repo root:
cd api

# Run all tests once (no coverage):
npm test

# Run with coverage report (enforces thresholds):
npm run test:coverage

# Watch mode during development:
npm run test:watch
```

Coverage report prints to the terminal. An `lcov` file is written to `api/coverage/lcov.info`.

### Frontend test suite

```bash
# From repo root:
cd frontend

# Run all tests once (no coverage):
npm test

# Run with coverage report (enforces thresholds):
npm run test:coverage     # (added by this feature)

# Watch mode during development:
npm run test:watch
```

Coverage report prints to the terminal. An `lcov` file is written to `frontend/coverage/lcov.info`.

---

## Writing a New Unit Test

### API — pure function example

```ts
// api/src/utils/__tests__/http.test.ts
import { describe, it, expect } from 'vitest';
import { apiError, resolveId } from '../http';

describe('apiError', () => {
  it('returns 404 shape', () => {
    const res = apiError(404, 'not found');
    expect(res.status).toBe(404);
    expect(res.jsonBody).toMatchObject({ error: 'Not Found', statusCode: 404 });
  });
});

describe('resolveId', () => {
  it('passes through a valid v4 UUID', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(resolveId(id)).toBe(id);
  });

  it('generates a new UUID for an invalid input', () => {
    const result = resolveId('bad-id');
    expect(result).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result).not.toBe('bad-id');
  });
});
```

### API — service with mocked Cosmos

```ts
// api/src/services/__tests__/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CosmosClientWrapper } from '../cosmos';

// Mock the cosmos module before importing session.ts
vi.mock('../cosmos', () => ({
  cosmosClient: {
    upsert: vi.fn().mockImplementation(async (doc) => doc),
    queryById: vi.fn().mockResolvedValue([]),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<CosmosClientWrapper>,
}));

// Mock env to provide SESSION_SECRET
vi.mock('../../config/env', () => ({
  SESSION_SECRET: 'test-secret-min-32-chars-xxxxxxxxxx',
  SESSION_ACCESS_TTL: 900,
  SESSION_REFRESH_TTL: 604800,
}));

import { createSession } from '../session';

describe('createSession', () => {
  it('returns an access token and a refresh token', async () => {
    const result = await createSession('user-1', 'user@example.com', 'entra');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.expiresIn).toBeGreaterThan(0);
  });
});
```

### Frontend — pure function example

```ts
// frontend/src/services/__tests__/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { normalize, scoreToRange, evaluateAnswer } from '../scoring';

describe('normalize', () => {
  it('strips punctuation and lowercases', () => {
    expect(normalize('Héllo, World!')).toBe('héllo world');
  });

  it('handles CJK text without stripping characters', () => {
    expect(normalize('你好，世界')).toBe('你好世界');
  });
});

describe('scoreToRange', () => {
  it.each([
    [0, 'dormant'],
    [19, 'dormant'],
    [20, 'sprouting'],
    [39, 'sprouting'],
    [40, 'echoing'],
    [60, 'inscribed'],
    [80, 'engraved'],
    [100, 'engraved'],
  ])('score %i → %s', (score, expected) => {
    expect(scoreToRange(score)).toBe(expected);
  });
});
```

### Frontend — React component example

```tsx
// frontend/src/components/search/__tests__/SearchBar.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  it('calls onSearch when the user types', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    await userEvent.type(screen.getByRole('searchbox'), 'hello');
    expect(onSearch).toHaveBeenCalledWith(expect.stringContaining('hello'));
  });
});
```

---

## Coverage Report Interpretation

After running `npm run test:coverage`, the terminal output shows a table like:

```
Coverage Report
  Statements : 82.4% ( 247/300 )
  Branches   : 76.1% ( 96/126 )
  Functions  : 85.0% ( 51/60 )
  Lines      : 82.4% ( 247/300 )
```

If any dimension falls below the configured threshold, the process exits with code 1 and a message like:
```
ERROR: Coverage for lines (62%) does not meet threshold (80%)
```

This failure is the signal to write more tests before merging.

---

## Threshold Violation Recovery

If the test run fails due to coverage:

1. Check the `Uncovered Lines` column in the coverage table to identify under-covered files.
2. Write tests for the flagged functions/branches.
3. Re-run `npm run test:coverage` to verify thresholds pass.
4. Do **not** lower the thresholds — escalate to the team if a genuine exemption is needed.

---

## Adding Tests for New Features (Ongoing)

When implementing any new API service function or frontend hook/component:

1. Create `__tests__/<module>.test.ts(x)` alongside the source file.
2. Follow the mock patterns above (inject `CosmosClientWrapper` for API; `vi.mock` for external modules).
3. Cover at least: the happy path, one error/edge case, and any branch conditions.
4. Run `npm run test:coverage` locally before pushing — CI will block merges that drop below thresholds.

This is enforced by the copilot instructions (see `.github/copilot-instructions.md`) and the project constitution (see `.specify/memory/constitution.md`).
