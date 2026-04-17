# Implementation Plan: Adaptive Learning State & Redesigned Review Sessions

**Branch**: `002-adaptive-learning-state` | **Date**: 2026-04-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-adaptive-learning-state/spec.md`

## Summary

Replace the manual `LearningState` enum (`new` | `learning` | `mastered`) on every `VocabularyEntry` with a numeric `learningScore` (0–100). Score changes exclusively through redesigned Review sessions where users type target-language translations into a flashcard interface; correct answers gain points, incorrect answers or skips lose points, with proportional penalties for hints and typos. Progress persists per-flashcard. Two session types (Random / Targeted) and a daily-review-once-per-entry limit complete the model.

Technical approach: all scoring logic runs client-side (IndexedDB via Dexie); score updates sync to Cosmos DB via the existing `pendingSync` mutation queue. No new Azure services are required. Levenshtein edit distance (Unicode-aware, language-agnostic) drives typo tolerance.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + API)
**Primary Dependencies**: React 18, Vite, Dexie.js 4.x, MSAL.js v3, react-router-dom (frontend); Azure Functions Node.js v4, @azure/cosmos, isomorphic-dompurify (API); `fastest-levenshtein` (new, frontend scoring)
**Storage**: IndexedDB (Dexie.js) — client-side primary store; Azure Cosmos DB Serverless NoSQL — server-side sync target
**Testing**: Vitest (frontend + API); deterministic unit tests for scoring module
**Target Platform**: PWA (Chrome, Safari, Firefox, mobile browsers); Azure Functions Node.js 20 LTS
**Project Type**: PWA + serverless API (monorepo — `frontend/` + `api/`)
**Performance Goals**: Synchronous local score writes (<5 ms); immediate UI reactivity via Dexie live queries; background sync non-blocking
**Constraints**: Offline-capable (non-negotiable per constitution); $100/month cost ceiling; no AI involvement in scoring
**Scale/Scope**: Private preview — <100 concurrent users; no new Azure resources required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with the VocaBook constitution (`.specify/memory/constitution.md`) for
each principle below:

- ✅ **I. Encounter-First** — The feature adds no app-assigned vocabulary. Review sessions operate exclusively on entries the user created. Random and Targeted session types are user-initiated choices, not mandated curricula.
- ✅ **II. Learner Ownership** — `learningScore` is a system-derived integer field. Users retain full edit and delete rights over every entry. The automatic migration is lossless and the score can be indirectly influenced by the user (via review behaviour). No AI-generated content is involved.
- ✅ **III. Offline-First** *(NON-NEGOTIABLE)* — All scoring computation occurs in the browser using `fastest-levenshtein` and local IndexedDB writes via Dexie. The session itself is managed as React state. Score deltas queue into `pendingSync` exactly like the existing mutation pattern and replay when online.
- ✅ **IV. AI as Assistant** — No AI calls anywhere in this feature. Typo tolerance and normalization are deterministic algorithms.
- ✅ **V. Cost-Conscious** — No new Azure services. `learningScore` (integer) and `lastReviewedDate` (ISO date string) are stored as fields on the existing `VocabularyEntry` Cosmos DB document — no new collection, no new throughput. `fastest-levenshtein` is a zero-dependency, <2 KB front-end library. Estimated cost delta: negligible.

## Project Structure

### Documentation (this feature)

```text
specs/002-adaptive-learning-state/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output — updated entry schema
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── entry/
│   │   │   ├── LearningScoreBar.tsx        [NEW]   — heat-map progress bar
│   │   │   ├── LearningScoreBar.module.css [NEW]
│   │   │   ├── ReviewCard.tsx              [REPLACE] — typed-input flashcard (replaces reveal/toggle card)
│   │   │   ├── ReviewCard.module.css       [UPDATE]
│   │   │   ├── LearningStateToggle.tsx     [DELETE] — replaced by LearningScoreBar
│   │   │   └── LearningStateToggle.module.css [DELETE]
│   │   └── review/
│   │       ├── SessionSetup.tsx            [NEW]   — session type + size picker
│   │       ├── SessionSetup.module.css     [NEW]
│   │       ├── FlashcardSession.tsx        [NEW]   — active session loop host
│   │       └── FlashcardSession.module.css [NEW]
│   ├── pages/
│   │   ├── Review.tsx                      [REDESIGN] — orchestrates setup → session → summary
│   │   └── Review.module.css               [UPDATE]
│   ├── services/
│   │   ├── scoring.ts                      [NEW]   — normalization, Levenshtein, gain/loss calc
│   │   └── db.ts                           [UPDATE] — version 2 schema + migration
│   └── types/
│       └── models.ts                       [UPDATE] — learningScore, lastReviewedDate

api/
└── src/
    ├── models/
    │   └── types.ts                        [UPDATE] — learningScore, lastReviewedDate on VocabularyEntry
    └── functions/
        └── entries.ts                      [UPDATE] — validate/sanitise learningScore
```

**Structure Decision**: Existing `frontend/` + `api/` two-project layout is unchanged. The review session components are grouped under `frontend/src/components/review/` (new subdirectory) to separate session orchestration from per-entry display components.

## Complexity Tracking

> No constitution violations — section intentionally empty.
