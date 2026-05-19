# Research: Rehearse Review Mode

**Phase 0 output** | Branch: `feature/009-rehearse-review-mode` | Date: 2026-05-18

All NEEDS CLARIFICATION items from spec and plan resolved below.

---

## 1. Swipe Gesture Implementation

**Question**: How to implement left/right swipe navigation on mobile without adding a new dependency?

**Decision**: Implement a bespoke `useSwipe` hook using native browser `touchstart` / `touchend` events.

**Rationale**:
- No suitable swipe library is already in the dependency list; adding one for a single use case violates the YAGNI / cost-conscious constitution principle.
- The gesture required (horizontal swipe left = next, right = prev) is straightforward enough to implement with ~30 lines of TypeScript.
- Native `Touch` events have excellent coverage on iOS Safari and Android Chrome — the two mobile targets.
- A hook encapsulates the logic cleanly and is independently testable with `@testing-library/react`.

**Implementation pattern**:

```ts
// frontend/src/hooks/useSwipe.ts
import { useEffect, useRef } from 'react';

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal movement in px to count as a swipe. Default: 50 */
  threshold?: number;
}

export function useSwipe<T extends HTMLElement>(
  options: UseSwipeOptions,
): React.RefObject<T> {
  const ref = useRef<T>(null);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      startX.current = e.touches[0]?.clientX ?? null;
    }

    function onTouchEnd(e: TouchEvent) {
      if (startX.current === null) return;
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const delta = endX - startX.current;
      const minDelta = options.threshold ?? 50;
      if (delta < -minDelta) options.onSwipeLeft?.();
      else if (delta > minDelta) options.onSwipeRight?.();
      startX.current = null;
    }

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

**Alternatives considered**:
- `react-swipeable` (npm) — rejected: adds a dependency for a trivial use case.
- CSS `scroll-snap` — rejected: doesn't provide a hook-friendly programmatic navigation model.

---

## 2. Session Setup UI Extension Strategy

**Question**: Should the rehearse configuration be a separate page/component, or should `SessionSetup` be extended?

**Decision**: Extend the existing `SessionSetup` component with a top-level **review mode** toggle (`'competitive' | 'rehearse'`). Conditionally show rehearse-only fields (PoS filter, tag filter) when mode is `'rehearse'`. The existing `SessionType` (`'random' | 'targeted'`) maps to the selection strategy and applies to both modes.

**Rationale**:
- Single entry-point for all review configuration is simpler for users — they pick the mode, then configure it.
- The phrasebook picker, card count, and session type (random/targeted) are shared between both modes; duplicating them in a separate component would be DRY violation.
- Rehearse-only fields (PoS/tag filters) add modest UI surface that fits naturally under the existing phrasebook picker.
- `onStart` callback signature needs extending: add `reviewMode`, `posFilter`, and `tagFilter` parameters.

**Extended `onStart` signature**:

```ts
export type ReviewMode = 'competitive' | 'rehearse';

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

**Alternatives considered**:
- Separate `RehearseSetup` component — rejected: duplicate configuration surface (phrasebook picker, card count, session type).
- Separate `/rehearse` route — rejected: unnecessary routing complexity; both modes share the same Review page lifecycle.

---

## 3. Entry Filtering by Part of Speech and Tags

**Question**: How to efficiently filter entries by PoS and tags within Dexie when building the rehearse pool?

**Decision**: Use a new `getEntriesForRehearsal` function in `db.ts` that:
1. Queries all entries for the user + phrasebook (same base query as `getEntriesForSession`).
2. Applies in-memory PoS and tag filters (arrays, AND logic: entry must match all applied filters).
3. Applies the `targeted` scoring strategy (sort by `learningScore` asc) or shuffles randomly.
4. Returns the first `size` entries.

In-memory filtering is acceptable here because:
- Phrasebooks are user-scoped and typically small (20–500 entries).
- Dexie's multi-valued `*tags` index supports efficient filtering, but combining PoS + tags + learningScore sort in a single Dexie query would require a compound index that doesn't currently exist and isn't justified for a small dataset.
- The existing `getEntriesForSession` uses the same pattern.

**Filter logic**:

```ts
// AND semantics: entry must satisfy all active filters
let pool = all.filter((e) => {
  if (posFilter.length > 0 && !posFilter.includes(e.partOfSpeech as PartOfSpeech)) return false;
  if (tagFilter.length > 0 && !tagFilter.some((t) => e.tags.includes(t))) return false;
  return true;
});
```

**Tag list source**: Tags available for filtering are derived from the entries in the selected phrasebook. `SessionSetup` receives them by querying `db.entries.where('phrasebookId').equals(id).toArray()` and collecting unique tag values. This avoids a separate tags table.

**Alternatives considered**:
- Dexie compound index for PoS + tags — rejected: would require a DB schema migration (`version(3)`) for marginal gain given small dataset sizes.

---

## 4. No-Score-Change Guarantee

**Question**: How to guarantee rehearse sessions never mutate learning scores, given the existing mutation-heavy `FlashcardSession` pattern?

**Decision**: `RehearseSession` is a completely separate component from `FlashcardSession`. It imports nothing from the scoring service and makes no calls to `updateEntry` or `enqueueMutation`. There is no mechanism by which it could accidentally modify scores.

**Rationale**: Isolation by construction is safer than an opt-out flag on the existing session. A code review can trivially confirm no scoring imports are present.

---

## 5. Flashcard Presentation Design

**Question**: What should a "presentation-friendly, neat" rehearse card look like given the existing design language?

**Decision**: A full-bleed card with clear visual hierarchy:

```
┌─────────────────────────────────┐
│  [source expression — large]    │
│  [target translation — large]   │
│  ─────────────────────────────  │
│  Part of speech  · Tags         │
│  ─────────────────────────────  │
│  Notes                          │
│  ─────────────────────────────  │
│  Example sentences (if any)     │
│  Synonyms / Antonyms (if any)   │
│  Collocations (if any)          │
│  Register (if any)              │
│  False-friend warning (if any)  │
└─────────────────────────────────┘
```

Sections with no content are omitted entirely (not shown as empty). This matches the design language already used in `EntryList.tsx` where optional fields are conditionally rendered.

**Enrichment display**: `RehearseCard` accepts `entry: DBEntry` and `enrichment: DBEnrichment | undefined`. If `enrichment` is undefined (entry has no enrichments), the enrichment sections are simply not rendered — no error, no placeholder.

---

## 6. Session End State for Rehearse

**Question**: Does rehearse need a summary screen like competitive mode?

**Decision**: A minimal end-of-session confirmation screen — not the full stats summary used in competitive mode. Shows a short message ("You've rehearsed N cards") and two actions: "Rehearse again" (resets to setup) and "Done" (navigates back). No per-card breakdown (there are no scores to report).

**Rationale**: A complex summary with no score data would be confusing. A clean end state confirms completion without implying scoring.

---

## 7. Keyboard Navigation (Desktop)

**Question**: What keyboard shortcut is appropriate for advancing cards on desktop?

**Decision**: `ArrowRight` = next card; `ArrowLeft` = previous card. Also provide visible "← Prev" / "Next →" buttons as the primary non-touch interaction model (keyboard shortcuts are a secondary convenience).

**Rationale**: Arrow keys are the most discoverable keyboard shortcut for "next/previous item" interactions. The buttons ensure the feature is fully accessible without requiring keyboard shortcut discovery.

---

## 8. "No score impact" Notice Placement

**Question**: Where and how should the "this session doesn't affect your learning score" notice appear?

**Decision**:
- **Setup screen**: Below the "Rehearse" mode radio button as explanatory copy (`span` with smaller font, not an alert).
- **During session**: A persistent, unobtrusive badge at the top of the session header (e.g., "Rehearse mode — scores not affected"). Same visual zone as the progress counter.

**Rationale**: Placing the notice only at setup could be forgotten. Keeping it visible during the session — without being disruptive — prevents confusion mid-session.

---

## Constitution Re-check (post-design)

All five constitution principles remain compliant:
- ✅ I. Encounter-First — reads only user-created entries
- ✅ II. Learner Ownership — read-only; no writes to any user data
- ✅ III. Offline-First — all reads from IndexedDB; no network calls in any code path
- ✅ IV. AI as Assistant — no AI calls
- ✅ V. Cost-Conscious — zero infrastructure cost; no new dependencies
