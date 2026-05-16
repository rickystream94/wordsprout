# Implementation Plan: Data Export & Import

**Branch**: `006-data-export-import` | **Date**: 2026-05-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/006-data-export-import/spec.md`

## Summary

Enable authenticated users to export all their phrasebooks, entries, and enrichments as a single versioned JSON file (client-side generation from IndexedDB, preceded by an online sync pull when the device is connected), and to restore from that file via a new server-side `POST /data/import` endpoint that validates schema, sanitises all text content with DOMPurify, atomically replaces all content-type documents (phrasebooks, entries, enrichments) in Cosmos DB, and rehydrates IndexedDB on the client. A new `/settings` page surfaces both actions under an Account Data section.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + API)
**Primary Dependencies**: React 18, Dexie.js 4.x (IndexedDB), MSAL.js v3, react-router-dom (frontend); Azure Functions Node.js v4, @azure/cosmos, isomorphic-dompurify (API)
**Storage**: IndexedDB via Dexie.js (client primary); Azure Cosmos DB Serverless NoSQL (server)
**Testing**: Vitest (frontend + API)
**Target Platform**: PWA — all modern browsers (Chrome, Firefox, Safari, Edge) on desktop, tablet, and mobile
**Project Type**: Web application (frontend SPA + serverless API)
**Performance Goals**: Export completes in < 10 s for 10,000 entries; Import API responds in < 30 s for 10,000 entries
**Constraints**: Export is offline-capable (reads IndexedDB); Import requires network connectivity (atomic server-side overwrite); import file size ≤ 10 MB (client-validated before upload + server-validated before processing); no AI calls; import rate-limited (1 per 5 minutes per user); $0 additional operating cost for export; negligible Cosmos RU cost for import
**Scale/Scope**: Up to 500 phrasebooks, 10,000 entries, 10,000 enrichments; 1 new API endpoint, 2 new frontend files (Settings page + export service), 5 modified files (types.ts, db.ts, main.tsx, UserMenu.tsx, api.ts)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with the WordSprout constitution (`.specify/memory/constitution.md`) for
each principle below. Mark ✅ compliant, ⚠ needs justification, or N/A:

- ✅ **I. Encounter-First** — N/A. This feature does not add any app-assigned or mandated vocabulary. It only moves user-owned data in and out of the system.
- ✅ **II. Learner Ownership** — This feature IS the direct implementation of the Principle II requirement: "The data model and storage architecture MUST NOT prevent future portable export of all user data." Export gives users full ownership of their data; all imported entries are immediately editable and deletable.
- ⚠️ **III. Offline-First** *(NON-NEGOTIABLE)* — Export is offline-capable (reads from IndexedDB; triggers a best-effort sync pull first if online, but does not block on it). Import requires network connectivity. See Complexity Tracking.
- ✅ **IV. AI as Assistant** — No AI calls at any point in this feature.
- ✅ **V. Cost-Conscious** — Export: zero cost (client-side only). Import: Cosmos RU cost ≈ $0.06 per full 10,000-entry import (at $0.282/million RUs × ~220,000 RUs for delete + insert). Rate-limiting (1 import per 5 minutes per user) prevents abuse. No new Azure infrastructure required.

*Post-design re-check*: All five checks confirmed after Phase 1 design. No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/006-data-export-import/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── api.md           ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
api/
└── src/
    ├── models/
    │   └── types.ts                    ← MODIFY: add ExportPackage types; add lastImportAt? to User
    └── functions/
        └── dataPortability.ts          ← NEW: POST /data/import handler

frontend/
└── src/
    ├── services/
    │   ├── api.ts                      ← MODIFY: add importData()
    │   ├── db.ts                       ← MODIFY: add clearUserContent(), bulkRestoreFromExport()
    │   └── export.ts                   ← NEW: generateExportPackage(), triggerDownload(), validateImportFile()
    ├── pages/
    │   ├── Settings.tsx                ← NEW: Settings page with Export + Import UI
    │   └── Settings.module.css         ← NEW: page styles
    ├── components/
    │   └── layout/
    │       └── UserMenu.tsx            ← MODIFY: add Settings nav link
    └── main.tsx                        ← MODIFY: add /settings route under AppShell
```

**Structure Decision**: Web application layout (frontend SPA + serverless API). All changes are contained within existing packages; no new packages or Azure resources required.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| III. Offline-First — Import requires network | Import performs an atomic full overwrite: delete all existing content docs in Cosmos, then write the full imported dataset. This cannot be expressed as a simple sync-queue mutation sequence. A queue of thousands of individual mutations would leave the user in a partial state if the device goes offline mid-import. | Queuing individual mutations for each imported entity via the existing sync queue was rejected: (1) non-atomic — partial failure leaves inconsistent state; (2) the `POST /phrasebooks` duplicate-language-pair check would fire on the second import of the same backup; (3) no clean mechanism to "delete all, then re-create" in a queue-based model; (4) thousands of queue items degrade sync performance for other mutations. |
