# Developer Quickstart: Rehearse Review Mode

**Feature**: `009-rehearse-review-mode` | **Date**: 2026-05-18

This guide walks through everything a developer needs to implement this feature from scratch.

---

## Prerequisites

- Branch `feature/009-rehearse-review-mode` checked out
- Node.js 20 LTS
- `npm install` already run in `frontend/`
- `npm run dev` working in `frontend/`

**No new npm dependencies required.** No `api/` changes.

---

## Key Files — What Changes Where

### 1. New types in `SessionSetup.tsx`

Add `ReviewMode` export alongside existing `SessionType`:

```ts
// frontend/src/components/review/SessionSetup.tsx
export type ReviewMode = 'competitive' | 'rehearse';

// Extend onStart callback signature
interface SessionSetupProps {
  phrasebooks: DBPhrasebook[];
  onStart: (
    mode: ReviewMode,
    type: SessionType,
    size: number,
    phrasebookId: string,
    posFilter: PartOfSpeech[],
    tagFilter: string[],
  ) => void;
}
```

### 2. Extend `SessionSetup` component

Add a **review mode toggle** at the top (Competitive / Rehearse). When `mode === 'rehearse'`:
- Show a notice: "Rehearse sessions don't affect your learning score"
- Show a PoS multiselect (checkboxes for each `PartOfSpeech` value — only values present in the selected phrasebook's entries need to be shown)
- Show a tag multiselect (tags derived from selected phrasebook via `getAvailableTagsForPhrasebook`)
- Disable Start if filtered entry count is 0

When `mode === 'competitive'`: hide those fields; pass `posFilter: []` and `tagFilter: []`.

```ts
// Inside SessionSetup:
const [reviewMode, setReviewMode] = useState<ReviewMode>('competitive');
const [posFilter, setPosFilter] = useState<PartOfSpeech[]>([]);
const [tagFilter, setTagFilter] = useState<string[]>([]);

// Derive available tags async (useLiveQuery or useEffect):
// const availableTags = useLiveQuery(
//   () => userId ? getAvailableTagsForPhrasebook(userId, effectivePhrasebookId) : Promise.resolve([]),
//   [userId, effectivePhrasebookId]
// ) ?? [];
```

### 3. Extend `Review.tsx` page

Add `ReviewMode` to `handleStart` and route to `RehearseSession` vs `FlashcardSession`:

```ts
// frontend/src/pages/Review.tsx
import RehearseSession from '../components/review/RehearseSession';
import type { ReviewMode } from '../components/review/SessionSetup';

// Extend state:
const [reviewMode, setReviewMode] = useState<ReviewMode>('competitive');

// Extend handleStart:
async function handleStart(
  mode: ReviewMode,
  type: SessionType,
  size: number,
  phrasebookId: string,
  posFilter: PartOfSpeech[],
  tagFilter: string[],
) {
  if (!userId) return;
  let entries: DBEntry[];
  if (mode === 'rehearse') {
    entries = await getEntriesForRehearsal(userId, type, size, phrasebookId, posFilter, tagFilter);
  } else {
    entries = await getEntriesForSession(userId, type, size, phrasebookId);
  }
  setReviewMode(mode);
  setSessionEntries(entries);
  setTargetLanguageName(phrasebooks.find((pb) => pb.id === phrasebookId)?.targetLanguageName);
  setPhase('session');
}

// In render: branch on reviewMode
if (phase === 'session') {
  return reviewMode === 'rehearse'
    ? <RehearseSession entries={sessionEntries} onDone={() => setPhase('setup')} />
    : <FlashcardSession entries={sessionEntries} onDone={handleSessionDone} targetLanguageName={targetLanguageName} />;
}
```

### 4. New hook: `useSwipe`

```ts
// frontend/src/hooks/useSwipe.ts
import { useEffect, useRef } from 'react';

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // px, default 50
}

export function useSwipe<T extends HTMLElement>(
  options: UseSwipeOptions,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0]?.clientX ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (startX.current === null) return;
      const delta = (e.changedTouches[0]?.clientX ?? 0) - startX.current;
      const min = options.threshold ?? 50;
      if (delta < -min) options.onSwipeLeft?.();
      else if (delta > min) options.onSwipeRight?.();
      startX.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [options]);

  return ref;
}
```

### 5. New component: `RehearseSession`

```ts
// frontend/src/components/review/RehearseSession.tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import type { DBEntry } from '../../services/db';
import RehearseCard from './RehearseCard';
import { useSwipe } from '../../hooks/useSwipe';
import styles from './RehearseSession.module.css';

interface RehearseSessionProps {
  entries: DBEntry[];
  onDone: () => void;
  targetLanguageName?: string;
  sourceLanguageName?: string;
}

export default function RehearseSession({
  entries, onDone, targetLanguageName, sourceLanguageName,
}: RehearseSessionProps) {
  const [index, setIndex] = useState(0);

  const enrichments = useLiveQuery(
    () => db.enrichments.where('entryId').anyOf(entries.map((e) => e.id)).toArray(),
    [entries],
  );
  const enrichmentMap = Object.fromEntries((enrichments ?? []).map((e) => [e.entryId, e]));

  const current = entries[index];

  function goNext() {
    if (index + 1 >= entries.length) { onDone(); return; }
    setIndex((i) => i + 1);
  }
  function goPrev() {
    if (index === 0) return;
    setIndex((i) => i - 1);
  }

  const swipeRef = useSwipe<HTMLDivElement>({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  if (!current) return null;

  return (
    <div className={styles.session} ref={swipeRef}>
      <div className={styles.header}>
        <button type="button" onClick={onDone} className={styles.exitBtn}>← Exit</button>
        <span className={styles.progress}>{index + 1} / {entries.length}</span>
        <span className={styles.rehearseBadge}>Rehearse — scores not affected</span>
      </div>

      <RehearseCard
        key={current.id}
        entry={current}
        enrichment={enrichmentMap[current.id]}
        targetLanguageName={targetLanguageName}
        sourceLanguageName={sourceLanguageName}
      />

      <div className={styles.nav}>
        <button type="button" onClick={goPrev} disabled={index === 0} className={styles.navBtn}>
          ← Prev
        </button>
        <button type="button" onClick={goNext} className={styles.navBtn}>
          {index + 1 < entries.length ? 'Next →' : 'Finish'}
        </button>
      </div>
    </div>
  );
}
```

> **IMPORTANT**: `RehearseSession` must NOT import `updateEntry`, `enqueueMutation`, or any function from `services/scoring.ts`.

### 6. New component: `RehearseCard`

```tsx
// frontend/src/components/review/RehearseCard.tsx
import type { DBEntry, DBEnrichment } from '../../services/db';
import styles from './RehearseCard.module.css';

interface RehearseCardProps {
  entry: DBEntry;
  enrichment: DBEnrichment | undefined;
  targetLanguageName?: string;
  sourceLanguageName?: string;
}

export default function RehearseCard({ entry, enrichment, targetLanguageName, sourceLanguageName }: RehearseCardProps) {
  return (
    <article className={styles.card}>
      {/* Primary expressions */}
      <div className={styles.primary}>
        <p className={styles.sourceText} lang={undefined}>{entry.sourceText}</p>
        {entry.targetText && (
          <p className={styles.targetText}>{entry.targetText}</p>
        )}
      </div>

      {/* Metadata row */}
      <div className={styles.meta}>
        {entry.partOfSpeech && <span className={styles.pos}>{entry.partOfSpeech}</span>}
        {entry.tags.map((tag) => (
          <span key={tag} className={styles.tag}>{tag}</span>
        ))}
      </div>

      {/* Notes */}
      {entry.notes && (
        <section className={styles.section}>
          <h3 className={styles.sectionHeading}>Notes</h3>
          <p>{entry.notes}</p>
        </section>
      )}

      {/* Enrichments — only if present */}
      {enrichment && (
        <>
          {enrichment.exampleSentences.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>Example sentences</h3>
              <ul className={styles.list}>
                {enrichment.exampleSentences.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </section>
          )}
          {enrichment.synonyms.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>Synonyms</h3>
              <p>{enrichment.synonyms.join(', ')}</p>
            </section>
          )}
          {enrichment.antonyms.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>Antonyms</h3>
              <p>{enrichment.antonyms.join(', ')}</p>
            </section>
          )}
          {enrichment.collocations.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>Collocations</h3>
              <p>{enrichment.collocations.join(', ')}</p>
            </section>
          )}
          {enrichment.register && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>Register</h3>
              <p>{enrichment.register}</p>
            </section>
          )}
          {enrichment.falseFriendWarning && (
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>⚠ False friend</h3>
              <p>{enrichment.falseFriendWarning}</p>
            </section>
          )}
        </>
      )}
    </article>
  );
}
```

### 7. New service functions in `db.ts`

```ts
// frontend/src/services/db.ts

export async function getEntriesForRehearsal(
  userId: string,
  type: 'random' | 'targeted',
  size: number,
  phrasebookId: string,
  posFilter: PartOfSpeech[],
  tagFilter: string[],
): Promise<DBEntry[]> {
  const all = await db.entries.where('userId').equals(userId).toArray();
  let pool = all.filter((e) => e.phrasebookId === phrasebookId);

  if (posFilter.length > 0) {
    pool = pool.filter((e) => e.partOfSpeech !== undefined && posFilter.includes(e.partOfSpeech));
  }
  if (tagFilter.length > 0) {
    pool = pool.filter((e) => tagFilter.some((t) => e.tags.includes(t)));
  }
  if (pool.length === 0) return [];

  if (type === 'targeted') {
    pool.sort((a, b) => a.learningScore - b.learningScore);
    return pool.slice(0, size);
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, size);
}

export async function getAvailableTagsForPhrasebook(
  userId: string,
  phrasebookId: string,
): Promise<string[]> {
  const entries = await db.entries
    .where('userId').equals(userId)
    .filter((e) => e.phrasebookId === phrasebookId)
    .toArray();
  const tagSet = new Set<string>();
  for (const e of entries) {
    for (const t of e.tags) tagSet.add(t);
  }
  return [...tagSet].sort();
}
```

---

## Testing Strategy

### `useSwipe` hook — `frontend/src/hooks/__tests__/useSwipe.test.ts`

Test via `@testing-library/react`'s `renderHook`. Use `fireEvent.touchStart` / `fireEvent.touchEnd` with mocked `clientX` values.

Key cases:
- Swipe left (delta ≥ threshold) → `onSwipeLeft` called once
- Swipe right (delta ≥ threshold) → `onSwipeRight` called once
- Short movement (< threshold) → neither called
- Cleanup: listeners removed on unmount

### `RehearseCard` — `frontend/src/components/review/__tests__/RehearseCard.test.tsx`

Use `@testing-library/react` + CSS module mock.

Key cases:
- Renders source + target text
- Renders part of speech and tags when present
- Does not render enrichment sections when `enrichment === undefined`
- Does not render notes section when `entry.notes` is empty
- Renders all enrichment fields when all are populated
- Does not render individual sections for empty arrays

### `RehearseSession` — `frontend/src/components/review/__tests__/RehearseSession.test.tsx`

Key cases:
- Shows progress "1 / N"
- "Next →" button advances index; advances to finish after last card
- "← Prev" button retreats index; disabled on first card
- "← Exit" button calls `onDone`
- Score is NOT in the document at any point (guard against accidental import)
- `useLiveQuery` mocked for enrichments

### `getEntriesForRehearsal` — `frontend/src/services/__tests__/db.test.ts` (extend existing)

Key cases:
- Returns empty array when pool is empty
- PoS filter applied correctly (include/exclude)
- Tag filter applied correctly (OR within filter, AND with PoS)
- Combined PoS + tag filter (AND semantics)
- `targeted` type returns lowest-score entries first
- `random` type returns randomised subset (mock `Math.random`)
- Returns full filtered pool when pool smaller than `size`

### `SessionSetup` — extend existing test

Key cases:
- Mode toggle renders competitive/rehearse options
- Rehearse mode shows PoS/tag filter UI
- Competitive mode hides filter UI
- Notice "scores not affected" visible in rehearse mode
- `onStart` called with correct `ReviewMode`, `posFilter`, `tagFilter`

---

## Local Testing Workflow

```powershell
# Start dev server
cd frontend
npm run dev
# → open http://localhost:5173

# Run tests with coverage
npm run test:coverage
# → coverage thresholds must not regress

# Type-check
npx tsc --noEmit
```

**Manual verification checklist**:
1. Open Review page → confirm "Competitive / Rehearse" mode selector visible
2. Select Rehearse → confirm "scores not affected" notice visible
3. Select a phrasebook with tagged/typed entries → confirm PoS and tag filters show relevant options
4. Apply a PoS filter → start session → confirm only matching entries appear
5. Navigate to last card → click Finish → confirm session ends at setup screen
6. On mobile (DevTools device mode): swipe left → confirm card advances; swipe right → confirm card retreats
7. Check IndexedDB (DevTools Application) before and after session → confirm no score changes on any entry
8. Start rehearse → navigate away mid-session → confirm no score changes
