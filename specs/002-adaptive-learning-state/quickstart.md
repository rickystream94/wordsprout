# Developer Quickstart: Adaptive Learning State & Redesigned Review Sessions

**Feature**: `002-adaptive-learning-state` | **Date**: 2026-04-17

This guide covers what a developer needs to know to implement this feature from scratch — key patterns, call sites to change, new files to create, and local testing approach.

---

## Prerequisites

- Feature branch `002-adaptive-learning-state` checked out (already done)
- Node.js 20 LTS; `pnpm` or `npm`
- Run `npm install` in both `frontend/` and `api/`
- Local dev environment working (`npm run dev` in `frontend/`)

## New npm dependency

Install `fastest-levenshtein` in the **frontend** package only (scoring is client-side):

```bash
cd frontend
npm install fastest-levenshtein
```

> `fastest-levenshtein` exports `distance(a: string, b: string): number`. TypeScript types are bundled. Zero runtime dependencies.

---

## Key Files — What Changes Where

### 1. Shared type definitions

**`frontend/src/types/models.ts`** and **`api/src/models/types.ts`** — remove `LearningState` type and enum references; add `learningScore` and `lastReviewedDate` to `VocabularyEntry`:

```ts
// REMOVE:
export type LearningState = 'new' | 'learning' | 'mastered';

// ADD to VocabularyEntry interface:
learningScore: number;         // 0–100
lastReviewedDate: string | null; // 'YYYY-MM-DD' | null
// REMOVE from VocabularyEntry interface:
learningState: LearningState;
```

---

### 2. Dexie database schema migration

**`frontend/src/services/db.ts`** — add version 2 with upgrade:

```ts
this.version(2)
  .stores({
    phrasebooks: 'id, userId, createdAt, updatedAt',
    entries: 'id, userId, phrasebookId, learningScore, partOfSpeech, createdAt, updatedAt, *tags',
    enrichments: 'id, userId, entryId',
    pendingSync: '++id, status, createdAt',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    const MIGRATION_MAP: Record<string, number> = {
      new: 0,
      learning: 30,
      mastered: 90,
    };
    await tx.table('entries').toCollection().modify((entry) => {
      const oldState = (entry as any).learningState as string | undefined;
      entry.learningScore = oldState !== undefined ? (MIGRATION_MAP[oldState] ?? 0) : 0;
      entry.lastReviewedDate = null;
      delete (entry as any).learningState;
    });
  });
```

Also update the `DBEntry` interface in `db.ts`:

```ts
export interface DBEntry {
  // ...existing fields...
  learningScore: number;          // replaces learningState
  lastReviewedDate: string | null;
  // REMOVE: learningState: LearningState;
}
```

---

### 3. Scoring service (new file)

**`frontend/src/services/scoring.ts`** — all scoring logic:

```ts
import { distance } from 'fastest-levenshtein';

// Normalize: strip Unicode punctuation, collapse whitespace, lowercase
export function normalize(text: string): string {
  return text
    .replace(/\p{P}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Split into grapheme clusters (language-agnostic character count)
export function splitGraphemes(text: string): string[] {
  return [...new Intl.Segmenter().segment(text)].map((s) => s.segment);
}

export const BASE_GAIN = 10;
export const LOSS = 5;
export const TYPO_FACTOR = 0.8;
export const MAX_SCORE = 100;
export const MIN_SCORE = 0;

export function maxTypos(normalizedAnswer: string): number {
  const len = splitGraphemes(normalizedAnswer).length;
  return Math.max(1, Math.floor(len / 5));
}

export type AnswerOutcome = 'correct' | 'typo_correct' | 'incorrect';

export function evaluateAnswer(
  userInput: string,
  expectedAnswer: string,
): AnswerOutcome {
  const normInput = normalize(userInput);
  const normExpected = normalize(expectedAnswer);
  if (normInput === normExpected) return 'correct';
  if (distance(normInput, normExpected) <= maxTypos(normExpected)) return 'typo_correct';
  return 'incorrect';
}

export function computeScoreDelta(
  outcome: AnswerOutcome | 'skipped',
  hintsUsed: number,
  normalizedAnswerGraphemeCount: number,
): number {
  if (outcome === 'incorrect' || outcome === 'skipped') return -LOSS;

  const isTypo = outcome === 'typo_correct';
  const rawGain = isTypo ? Math.floor(BASE_GAIN * TYPO_FACTOR) : BASE_GAIN;
  const hintFactor = Math.max(0, 1 - hintsUsed / normalizedAnswerGraphemeCount);

  if (hintFactor <= 0) return 1; // minimum positive gain

  const final = Math.floor(rawGain * hintFactor);
  return Math.max(1, final);
}

export function applyDelta(currentScore: number, delta: number): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, currentScore + delta));
}

export function scoreToRange(score: number): 'new' | 'learning' | 'mastered' {
  if (score <= 25) return 'new';
  if (score <= 79) return 'learning';
  return 'mastered';
}
```

---

### 4. New UI components

#### `LearningScoreBar`

**`frontend/src/components/entry/LearningScoreBar.tsx`**:

```tsx
import { scoreToRange } from '../../services/scoring';
import styles from './LearningScoreBar.module.css';

interface Props {
  score: number; // 0–100
}

export default function LearningScoreBar({ score }: Props) {
  const range = scoreToRange(score);
  return (
    <div className={styles.track} title={`${score}/100 — ${range}`} aria-label={`Learning score: ${score} of 100`}>
      <div
        className={`${styles.fill} ${styles[`fill_${range}`]}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}
```

CSS in `LearningScoreBar.module.css`:
- `.track`: fixed-height bar container, grey background, rounded
- `.fill`: absolute fill div
- `.fill_new`: cool blue/teal color
- `.fill_learning`: warm yellow/amber color
- `.fill_mastered`: warm green/gold color

#### `SessionSetup`

**`frontend/src/components/review/SessionSetup.tsx`**: Renders a card with two session-type buttons (Random / Targeted) and a size stepper. Calls `onStart({ type, requestedSize })` prop.

#### `FlashcardSession`

**`frontend/src/components/review/FlashcardSession.tsx`**: Manages active session state (current card index, hint reveal state, input value). Calls `scoring.ts` functions for evaluation. Writes to Dexie + enqueues mutations after each card. Displays result feedback before advancing.

---

### 5. Redesigned Review page

**`frontend/src/pages/Review.tsx`** — replace existing implementation:

- State machine: `'setup' | 'session' | 'summary'`
- In `setup` phase: renders `<SessionSetup />`
- In `session` phase: renders `<FlashcardSession />`
- In `summary` phase: renders session statistics

---

### 6. API: entries.ts validation update

**`api/src/functions/entries.ts`** — in the PUT/PATCH handler, replace `learningState` validation with `learningScore` and `lastReviewedDate`:

```ts
// Validate learningScore if provided
if (body.learningScore !== undefined) {
  const score = Number(body.learningScore);
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return apiError(400, 'learningScore must be an integer between 0 and 100');
  }
}

// Validate lastReviewedDate if provided (allow null)
if (body.lastReviewedDate !== undefined && body.lastReviewedDate !== null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.lastReviewedDate)) {
    return apiError(400, 'lastReviewedDate must be YYYY-MM-DD or null');
  }
}
```

---

## Running Tests

```bash
# Frontend (scoring logic unit tests are the priority)
cd frontend && npm run test

# API
cd api && npm run test
```

Key test areas for this feature:
- `scoring.ts`: normalization edge cases, typo tolerance boundaries, hint factor formula, delta clamping
- Dexie migration: version upgrade runs correctly in happy path and for entries without `learningState`
- `SessionSetup`: renders correct options, calls onStart with right config
- `FlashcardSession`: skipping correctly triggers -5, daily limit blocks score change

---

## Local Dev Workflow

1. Start frontend dev server: `cd frontend && npm run dev`
2. Navigate to the Review page — you should see the new `SessionSetup` UI
3. After a session, check the phrasebook list to confirm `LearningScoreBar` updates
4. Open browser DevTools → IndexedDB → `WordSprout` → `entries` to verify `learningScore` and `lastReviewedDate` fields
5. Verify offline: toggle Network to Offline, run a session — score changes should persist locally, then sync when back online

---

## Invariants to Guard In Code

- `learningScore` is always an integer 0–100 — clamp using `applyDelta()`, never write raw arithmetic directly to IndexedDB
- `lastReviewedDate` must be set using `new Date().toLocaleDateString('sv')` (produces `YYYY-MM-DD` in local time, locale-independently)
- The daily review check: `entry.lastReviewedDate === new Date().toLocaleDateString('sv')` → skip score update
- Hints are indexed into `answerGraphemes` array (grapheme cluster array), not raw string characters
- Session flashcard list is assembled entirely in the browser — no API calls during an active session
