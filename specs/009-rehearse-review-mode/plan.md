# Implementation Plan: Rehearse Review Mode

**Branch**: `feature/009-rehearse-review-mode` | **Date**: 2026-05-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/009-rehearse-review-mode/spec.md`

## Summary

Introduce a **Rehearse** review type alongside the existing competitive review. Users select a phrasebook, card count, optional part-of-speech and tag filters, and an entry-selection strategy (prioritise low score or random). Cards are displayed one at a time in a read-only, enrichment-rich layout; swipe gestures navigate on touch devices; keyboard/button navigation on desktop. No score mutations occur. No network requests are made. All entry and enrichment data is read from IndexedDB.

Implementation is **frontend-only**: new `RehearseSession` component, new `RehearseCard` component, a `useSwipe` hook, extension of `SessionSetup` to accommodate the new mode, and a new `getEntriesForRehearsal` service function.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: React 18, Dexie.js 4.x (`dexie-react-hooks`), react-router-dom, CSS Modules
**Storage**: IndexedDB via Dexie.js (read-only during rehearse sessions)
**Testing**: Vitest 4.x, `@testing-library/react` 16.x, `@testing-library/user-event` 14.x
**Target Platform**: Progressive Web App — desktop browsers + mobile (iOS Safari, Android Chrome)
**Project Type**: Frontend feature extension (web-app)
**Performance Goals**: Card render < 16 ms (60 fps); session startup (DB query + shuffle) < 200 ms for up to 500 entries
**Constraints**: Fully offline; zero API calls during session; no new npm dependencies
**Scale/Scope**: Single-user; phrasebooks typically 20–500 entries; sessions 5–50 cards

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **I. Encounter-First** — No new vocabulary is introduced. The rehearse session reads only entries the user already added.
- ✅ **II. Learner Ownership** — All content is read-only during rehearse; no AI-generated content is written or overwritten. Enrichments shown are already user-editable via the existing entry detail view.
- ✅ **III. Offline-First** *(NON-NEGOTIABLE)* — Every interaction reads from IndexedDB. Zero network requests are made during setup or during a session. Fully functional with no connectivity.
- ✅ **IV. AI as Assistant** — This feature makes no AI calls. Enrichments displayed were previously user-triggered; they are only read here.
- ✅ **V. Cost-Conscious** — Pure frontend feature. No new Azure resources, no new serverless invocations, no new Cosmos reads. Zero marginal cost.

## Project Structure

### Documentation (this feature)

```text
specs/009-rehearse-review-mode/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

This feature is frontend-only. No `api/` changes.

```text
frontend/src/
├── components/
│   └── review/
│       ├── SessionSetup.tsx          MODIFY — add reviewMode toggle, PoS/tag filters, selection strategy
│       ├── SessionSetup.module.css   MODIFY — new filter UI styles
│       ├── RehearseSession.tsx       NEW — navigation-only session (no scoring)
│       ├── RehearseSession.module.css NEW
│       ├── RehearseCard.tsx          NEW — read-only full-entry display card
│       ├── RehearseCard.module.css   NEW
│       └── __tests__/
│           ├── SessionSetup.test.tsx MODIFY — cover new rehearse mode props
│           ├── RehearseSession.test.tsx NEW
│           └── RehearseCard.test.tsx  NEW
├── hooks/
│   ├── useSwipe.ts                   NEW — touch swipe gesture hook
│   └── __tests__/
│       └── useSwipe.test.ts          NEW
├── pages/
│   └── Review.tsx                    MODIFY — wire rehearse mode; route to RehearseSession
├── services/
│   ├── db.ts                         MODIFY — add getEntriesForRehearsal()
│   └── __tests__/
│       └── db.test.ts                MODIFY — cover getEntriesForRehearsal
└── types/
    └── models.ts                     NO CHANGE (PartOfSpeech already defined)
```

## Complexity Tracking

No constitution violations. No unjustified complexity introduced.
