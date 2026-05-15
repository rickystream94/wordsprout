# Implementation Plan: Sample Template Phrasebook

**Branch**: `feature/005-sample-template-phrasebook` | **Date**: 2026-05-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/005-sample-template-phrasebook/spec.md`

## Summary

Implement a one-click starter phrasebook generator that pre-populates a new phrasebook with 50 hardcoded vocabulary entries (with tags and enrichments) for any of 10 Indo-European target languages. Generation is entirely client-side (static data bundled in the frontend); results sync to the server via the existing mutation queue. The feature is surfaced prominently in the empty state for new users and accessible (less prominent) for users who already have phrasebooks. A companion change enforces a one-phrasebook-per-language-pair uniqueness rule across all phrasebook creation paths.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + API)
**Primary Dependencies**: React 18, Dexie.js 4.x, MSAL.js v3, react-router-dom (frontend); Azure Functions Node.js v4, @azure/cosmos, isomorphic-dompurify (API)
**Storage**: IndexedDB via Dexie.js (client primary); Azure Cosmos DB Serverless NoSQL (server sync target)
**Testing**: Vitest (frontend + API)
**Target Platform**: PWA (Chrome/Edge/Firefox/Safari desktop + mobile)
**Project Type**: Web application (frontend SPA + serverless API)
**Performance Goals**: Template generation (101 IndexedDB writes + 101 sync enqueue) completes in < 500 ms on a mid-range device
**Constraints**: Fully offline-capable; static template data must not require a network request; no AI calls; $0 incremental operating cost
**Scale/Scope**: 50 entries × 10 languages; touches 2 existing files (types, phrasebooks handler), 2 modified files (db.ts, Home.tsx), 2 new files (templatePhrasebooks.ts, TemplatePhrasebookWizard.tsx)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ⚠️ **I. Encounter-First** — This feature provides 50 app-curated vocabulary entries. Justified: single explicit opt-in user action; entries are fully mutable/deletable; no ongoing or automatic vocabulary assignment. See Complexity Tracking.
- ✅ **II. Learner Ownership** — All 50 generated entries are immediately editable and deletable. `fromTemplate` flag is cosmetic only; it does not lock any content.
- ✅ **III. Offline-First** *(NON-NEGOTIABLE)* — Template generation reads from a bundled static module; all writes go to IndexedDB. Works fully offline.
- ✅ **IV. AI as Assistant** — No AI calls at any point. Enrichment data is hardcoded static content.
- ✅ **V. Cost-Conscious** — Zero incremental cost. Static data is bundled into the frontend; no new Azure resources; no API calls during generation.

*Post-design re-check*: All five checks confirmed after Phase 1 design. No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/005-sample-template-phrasebook/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── api.md           ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (repository root)

```text
api/
└── src/
    ├── models/
    │   └── types.ts                    ← MODIFY: add fromTemplate? to Phrasebook
    └── functions/
        └── phrasebooks.ts              ← MODIFY: add duplicate language pair check (409)

frontend/
└── src/
    ├── data/
    │   └── templatePhrasebooks.ts      ← NEW: 50-entry static vocabulary data (all 10 languages)
    ├── services/
    │   └── db.ts                       ← MODIFY: fromTemplate on DBPhrasebook,
    │                                              duplicate guard in createPhrasebook(),
    │                                              new generateTemplatePhrasebook()
    ├── components/
    │   └── phrasebook/
    │       └── TemplatePhrasebookWizard.tsx  ← NEW: language picker + generation modal
    └── pages/
        └── Home.tsx                    ← MODIFY: EmptyState template CTA, header button,
                                                   PhrasebookCard "Starter" badge
```

**Structure Decision**: Web application layout (frontend + API). All changes are contained within existing packages; no new packages required.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Principle I (Encounter-First): 50 pre-curated entries provided by the app | New users have zero value from an empty app; without a meaningful starter set, review sessions are useless and users abandon before discovering the core loop | "Guided first entry" (manual one word at a time) doesn't solve the review-session richness problem; "demo/read-only mode" adds complexity and can't be used for real learning; doing nothing results in high early abandonment |
