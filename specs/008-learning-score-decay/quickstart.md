# Quickstart: Learning Score Decay

**Phase 1 output** | Branch: `feature/008-learning-score-decay` | Date: 2026-05-17

---

## Overview

This feature adds progressive learning score decay to phrasebook entries. When a user has not reviewed an entry for more than 14 days, the score decreases by 1 point every 3 days. Decay is computed at most once per calendar day, triggered by the existing app-load lifecycle in `main.tsx`.

No new infrastructure is needed. All changes are in the frontend.

---

## Running locally

```powershell
# From repo root
.\dev.ps1
# Frontend: http://localhost:5173
# API:      http://localhost:7071
```

---

## Testing the decay logic in isolation

```powershell
cd frontend
npm run test -- --reporter=verbose scoring.test
npm run test -- --reporter=verbose decay.test
```

---

## Manually verifying decay end-to-end

1. Open the app and ensure you are signed in.
2. In the browser DevTools console, run:

```javascript
// Simulate that today is 30 days after a review
import('/src/services/db.js').then(async ({ db }) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toLocaleDateString('sv'); // 'YYYY-MM-DD'

  // Manually set lastDecay to yesterday so decay re-runs today
  await db.meta.put({ key: 'lastDecay', value: '2000-01-01' });

  // Set one entry to have lastReviewedDate 30 days ago at score 100
  const entries = await db.entries.toArray();
  if (entries[0]) {
    await db.entries.update(entries[0].id, {
      learningScore: 100,
      lastReviewedDate: dateStr,
    });
    console.log('Entry score set to 100 with lastReviewedDate:', dateStr);
  }
});
```

3. Reload the page.
4. Open the phrasebook. The modified entry should now show a score of **95** (30 days − 7 grace = 23 post-grace days → `floor(23/3)` = 7 → score 100 − 7 = **93**).

---

## Decay formula reference

| Constant | Production default | Env var override | Meaning |
|---|---|---|---|
| `DECAY_GRACE_DAYS` | `7` | `VITE_DECAY_GRACE_DAYS` | Days after last review with no decay |
| `DECAY_RATE_DAYS` | `3` | `VITE_DECAY_RATE_DAYS` | Points lost per N days after grace |
| Floor | `0` | — | Score cannot go below zero |

To override locally for faster testing, add to `frontend/.env.local`:

```env
VITE_DECAY_GRACE_DAYS=0
VITE_DECAY_RATE_DAYS=1
```

This makes decay apply immediately (no grace) at 1 point per day — score of 100 will be fully decayed in 100 days of simulated time.

```
decayPoints = floor(max(0, daysElapsed - 7) / 3)
targetScore = max(0, decayBaseScore - decayPoints)
newScore    = min(currentScore, targetScore)
```

---

## Key files

| File | Purpose |
|---|---|
| `frontend/src/services/scoring.ts` | Add `computeDecay()`, `DECAY_GRACE_DAYS`, `DECAY_RATE_DAYS` |
| `frontend/src/services/decay.ts` | New — `applyDecayRound()` orchestrator |
| `frontend/src/main.tsx` | Wire `applyDecayRound` to app lifecycle |
| `frontend/src/services/__tests__/scoring.test.ts` | Unit tests for `computeDecay` |
| `frontend/src/services/__tests__/decay.test.ts` | New — unit tests for `applyDecayRound` |

---

## Example test cases for `computeDecay`

```typescript
// No decay within grace period (7 days)
expect(computeDecay(100, 100, '2026-05-10', '2026-05-17')).toBe(100); // 7 days = still in grace

// Decay starts at day 8
expect(computeDecay(100, 100, '2026-05-09', '2026-05-17')).toBe(100); // 8 days: floor(1/3)=0 → no change yet
expect(computeDecay(100, 100, '2026-05-06', '2026-05-17')).toBe(99);  // 11 days: floor(4/3)=1 → score 99

// Never reviewed → no decay
expect(computeDecay(0, null, null, '2026-05-17')).toBe(0);

// Score already 0 → no decay
expect(computeDecay(0, 0, '2026-01-01', '2026-05-17')).toBe(0);

// Floor at MIN_SCORE
expect(computeDecay(2, 100, '2025-01-01', '2026-05-17')).toBe(0); // massive elapsed → clamped to 0

// Idempotency: same result whether score is already decayed or not
expect(computeDecay(99, 100, '2026-05-06', '2026-05-17')).toBe(99); // already at target → unchanged
expect(computeDecay(100, 100, '2026-05-06', '2026-05-17')).toBe(99); // not yet decayed → decays to 99
```
