# Data Model: Adaptive Learning State & Redesigned Review Sessions

**Phase 1 output** | Branch: `002-adaptive-learning-state` | Date: 2026-04-17

---

## Schema Changes

### 1. `VocabularyEntry` — Modified fields

| Field | Before | After | Notes |
|---|---|---|---|
| `learningState` | `'new' \| 'learning' \| 'mastered'` | **removed** | Replaced by `learningScore` |
| `learningScore` | — | `number` (integer 0–100) | New field. See ranges below |
| `lastReviewedDate` | — | `string \| null` (`YYYY-MM-DD`) | Local date of last score-affecting review. `null` = never reviewed |

**Score ranges (display + session filtering)**:

| Range name | Score | Behaviour |
|---|---|---|
| New | 0–25 | Eligible for Targeted sessions |
| Learning | 26–79 | Eligible for Targeted sessions |
| Mastered | 80–100 | Eligible only for Random sessions |

**Cosmos DB document** (no separate collection — field change only):

```jsonc
// VocabularyEntry document — new shape
{
  "id": "uuid",
  "userId": "string",
  "type": "entry",
  "phrasebookId": "uuid",
  "sourceText": "string",
  "targetText": "string | undefined",
  "notes": "string | undefined",
  "tags": ["string"],
  "partOfSpeech": "noun | verb | ... | undefined",
  "learningScore": 0,          // integer 0-100
  "lastReviewedDate": null,    // "YYYY-MM-DD" or null
  "enrichmentId": "uuid | undefined",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

**Migration mapping** (FR-020):

| Old `learningState` | New `learningScore` |
|---|---|
| `'new'` | `0` |
| `'learning'` | `30` |
| `'mastered'` | `90` |

---

### 2. `DBEntry` — IndexedDB / Dexie (client-side)

Mirrors `VocabularyEntry`. Dexie schema advances to **version 2**.

**New Dexie index definitions** (version 2):
```text
entries: 'id, userId, phrasebookId, learningScore, partOfSpeech, createdAt, updatedAt, *tags'
```
(Replaces `learningState` index with `learningScore` index.)

**Version 2 upgrade function** logic:
1. Open all records in `entries` table.
2. For each record with `learningState` present: map to `learningScore` (see table above), set `lastReviewedDate = null`, delete `learningState` property.
3. Write updated record back.

---

### 3. Client-only runtime types (no persistence)

These types are **not stored**; they exist only as React state during an active session.

#### `ReviewSessionConfig`
```ts
interface ReviewSessionConfig {
  type: 'random' | 'targeted';
  requestedSize: number;         // default 20
  phrasebookId: string | null;   // null = all phrasebooks
}
```

#### `Flashcard` (session runtime)
```ts
interface Flashcard {
  entryId: string;
  sourceText: string;
  targetText: string;            // the expected answer
  normalizedAnswer: string;      // pre-computed normalized form
  answerGraphemes: string[];     // pre-split grapheme clusters (Intl.Segmenter)
  revealedIndices: Set<number>;  // hint-revealed grapheme positions
  hintsUsed: number;
  reviewedToday: boolean;        // true → no score change on submit
}
```

#### `FlashcardResult`
```ts
interface FlashcardResult {
  entryId: string;
  outcome: 'correct' | 'typo_correct' | 'incorrect' | 'skipped' | 'no_change';
  scoreDelta: number;            // positive = gain, negative = loss, 0 = no_change
  newScore: number;
}
```

---

## Scoring Logic

All computation is in `frontend/src/services/scoring.ts`.

### Normalisation

```
normalize(text):
  1. strip Unicode punctuation: text.replace(/\p{P}/gu, '')
  2. strip remaining dashes/hyphens: replace(/-/g, '') (already covered by \p{P}, redundant but explicit)
  3. collapse whitespace: replace(/\s+/g, ' ').trim()
  4. lowercase: toLowerCase()
```

### Edit-distance tolerance

```
maxTypos(normalizedAnswer):
  graphemeCount = countGraphemes(normalizedAnswer)
  return max(1, floor(graphemeCount / 5))

isClose(input, expected):
  return levenshtein(normalize(input), normalize(expected)) <= maxTypos(normalize(expected))
```

### Scoring formula

```
BASE_GAIN  = 10
TYPO_FACTOR = 0.80
LOSS       = 5
MAX_SCORE  = 100
MIN_SCORE  = 0

computeGain(hintsUsed, graphemeCount, isTypo):
  hint_factor = max(0, 1 - hintsUsed / graphemeCount)
  effective_hint_factor = hint_factor > 0 ? hint_factor : 0   // floor to 0

  raw_gain = BASE_GAIN
  if isTypo:
    raw_gain = floor(raw_gain * TYPO_FACTOR)       // → 8

  if effective_hint_factor <= 0:
    return 1                                        // minimum positive gain

  final = floor(raw_gain * effective_hint_factor)
  return max(1, final)                              // always at least 1 point if a correct answer

applyDelta(currentScore, delta):
  return clamp(currentScore + delta, MIN_SCORE, MAX_SCORE)
```

### Decision table (representative examples, BASE_GAIN=10)

| Answer type | Hints | Gain / Loss |
|---|---|---|
| Perfect correct | 0 | +10 |
| Typo-correct | 0 | +8 |
| Perfect correct | 50% of chars | +5 |
| Typo-correct | 50% of chars | +4 |
| Perfect correct | 100% of chars | +1 (minimum) |
| Incorrect | any | −5 |
| Skipped | any | −5 |
| Any (reviewed today) | any | 0 |

---

## API Contract Delta

Only one endpoint changes: `PATCH /entries/:id` (or `PUT /entries/:id`).

**New accepted fields** in request body:
- `learningScore: number` — validated: integer 0–100
- `lastReviewedDate: string | null` — validated: ISO date `YYYY-MM-DD` or null

**Removed accepted field**:
- `learningState` — still parsed for backwards compatibility during migration window, but ignored for new write path

See [contracts/openapi.yaml](contracts/openapi.yaml) for full schema update.

---

## State Machine: Flashcard Lifecycle

```
[SETUP] → user picks session type + size
    ↓
[LOADING] → eligible entries fetched from IndexedDB, shuffled/sorted, capped to size
    ↓ (empty Targeted? → [EMPTY STATE] → exit)
[CARD_SHOW] → Flashcard rendered (sourceText prompt)
    ↓
[AWAITING_INPUT] → user types / requests hints
    ↓
[EVALUATE] → normalize & compare → compute delta
    ↓
[PERSIST] → Dexie write + enqueueMutation (unless reviewedToday)
    ↓
[RESULT] → show outcome + score delta for ~1.5 s
    ↓ (more cards?) → [CARD_SHOW]
    ↓ (session complete) → [SUMMARY]
[EXIT (any time)] → navigate back; persisted scores retained
```
