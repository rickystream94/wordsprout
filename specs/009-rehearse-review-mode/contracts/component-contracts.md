# Component Contracts: Rehearse Review Mode

**Phase 1 output** | Branch: `feature/009-rehearse-review-mode` | Date: 2026-05-18

No backend API changes. This document defines the TypeScript component prop contracts and service function signatures introduced by this feature.

---

## `ReviewMode` (new type export)

```ts
// frontend/src/components/review/SessionSetup.tsx
export type ReviewMode = 'competitive' | 'rehearse';
```

---

## `SessionSetup` (modified)

### Props

```ts
interface SessionSetupProps {
  phrasebooks: DBPhrasebook[];
  onStart: (
    mode: ReviewMode,
    type: SessionType,       // 'random' | 'targeted' (unchanged)
    size: number,
    phrasebookId: string,
    posFilter: PartOfSpeech[],   // [] when no filter applied
    tagFilter: string[],          // [] when no filter applied
  ) => void;
}
```

### Behaviour contract

| Condition | Behaviour |
|---|---|
| `mode === 'competitive'` | PoS filter and tag filter fields are hidden; `posFilter` and `tagFilter` are always passed as `[]` |
| `mode === 'rehearse'` | PoS filter (multiselect of `PartOfSpeech` values) and tag filter (multiselect of tags from selected phrasebook) are shown |
| `mode === 'rehearse'` | A visible notice states "Rehearse sessions don't affect your learning score" |
| Applied filters match 0 entries | Start button is disabled; explanatory message shown |
| Applied filters match fewer entries than `size` | `actualSize` is capped; notice shown |

---

## `RehearseSession` (new)

### Props

```ts
interface RehearseSessionProps {
  entries: DBEntry[];
  onDone: () => void;
}
```

### Behaviour contract

| Condition | Behaviour |
|---|---|
| Session starts | Loads enrichments for all `entries` from IndexedDB in one query |
| Card navigation | Index advances/retreats; never goes below 0 or above `entries.length - 1` |
| Last card → swipe left / Next button | Calls `onDone()` |
| Any time | `onDone()` callable via "Exit session" button (interruption) |
| Session ends (all cards navigated or interrupted) | No learning score mutations; no sync mutations enqueued |

### Score-safety invariant

`RehearseSession` MUST NOT import or call any of:
- `updateEntry`
- `enqueueMutation`
- `applyDelta` / `computeScoreDelta` / `evaluateAnswer` (from `scoring.ts`)

This invariant is verifiable by static import analysis.

---

## `RehearseCard` (new)

### Props

```ts
interface RehearseCardProps {
  entry: DBEntry;
  enrichment: DBEnrichment | undefined;
  /** Used to label the source/target language pair, e.g. "Italian" */
  targetLanguageName?: string;
  sourceLanguageName?: string;
}
```

### Behaviour contract

| Condition | Behaviour |
|---|---|
| `enrichment === undefined` | Enrichment sections are not rendered (no "no data" placeholders) |
| `entry.notes` is empty string or undefined | Notes section not rendered |
| `entry.tags` is empty | Tags section not rendered |
| `entry.partOfSpeech` is undefined | Part-of-speech badge not rendered |
| All optional sections absent | Card renders gracefully with only source + target text |
| `exampleSentences`, `synonyms`, `antonyms`, `collocations` are empty arrays | Those sections not rendered |

---

## `useSwipe` (new hook)

```ts
// frontend/src/hooks/useSwipe.ts

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal travel in px to register as a swipe. Default: 50 */
  threshold?: number;
}

export function useSwipe<T extends HTMLElement>(
  options: UseSwipeOptions,
): React.RefObject<T | null>
```

### Behaviour contract

| Condition | Behaviour |
|---|---|
| Horizontal touch travel ≥ `threshold` in left direction | `onSwipeLeft` called once |
| Horizontal touch travel ≥ `threshold` in right direction | `onSwipeRight` called once |
| Touch travel < `threshold` | Neither callback called |
| Vertical-dominant touch (scroll) | Neither callback called (horizontal delta only) |
| Non-touch device | No event listeners attached; hook is a no-op |
| Component unmounts | Event listeners removed (cleanup in `useEffect` return) |

---

## `getEntriesForRehearsal` (new service function)

```ts
// frontend/src/services/db.ts

export async function getEntriesForRehearsal(
  userId: string,
  type: 'random' | 'targeted',
  size: number,
  phrasebookId: string,
  posFilter: PartOfSpeech[],
  tagFilter: string[],
): Promise<DBEntry[]>
```

### Behaviour contract

| Condition | Behaviour |
|---|---|
| `posFilter` is `[]` | No PoS filtering applied |
| `tagFilter` is `[]` | No tag filtering applied |
| Both filters active | AND semantics: entry must satisfy both |
| `tagFilter` has multiple values | OR semantics within the filter: entry must have at least one matching tag |
| `type === 'targeted'` | Sort by `learningScore` ascending; return first `size` |
| `type === 'random'` | Fisher-Yates shuffle; return first `size` |
| Filtered pool smaller than `size` | Returns entire filtered pool (no error) |
| Filtered pool is empty | Returns `[]` |
| **No writes to IndexedDB under any condition** | |

---

## `getAvailableTagsForPhrasebook` (new service function)

```ts
// frontend/src/services/db.ts

export async function getAvailableTagsForPhrasebook(
  userId: string,
  phrasebookId: string,
): Promise<string[]>
```

Returns deduplicated, sorted list of all tags used by entries in the specified phrasebook. Returns `[]` if no entries have tags.
