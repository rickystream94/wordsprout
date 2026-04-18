# Implementation Plan: Privacy & Compliance

**Branch**: `004-privacy-compliance` | **Date**: 2026-04-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/004-privacy-compliance/spec.md`

## Summary

Add GDPR-aligned privacy and compliance features to WordSprout: a public Privacy Policy page
(`/privacy`), a public Terms & Conditions page (`/terms`), and a user-initiated account
deletion flow. Account deletion permanently removes all server-side Cosmos DB records
(user, allowlist, phrasebooks, entries, enrichments) and all local Dexie/IndexedDB data,
then signs the user out. Both static pages are bundled with the app and available offline.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + API)
**Primary Dependencies**: React 18, react-router-dom, Dexie.js 4.x, MSAL.js v3 (frontend); Azure Functions Node.js v4, @azure/cosmos, isomorphic-dompurify, jsonwebtoken, jwks-rsa (API)
**Storage**: Azure Cosmos DB Serverless (server-side); IndexedDB via Dexie.js (client-side)
**Testing**: Vitest (frontend + API)
**Target Platform**: PWA (modern browsers, Chrome/Firefox/Safari/Edge)
**Project Type**: Web application (frontend SPA + serverless API)
**Performance Goals**: Account deletion completes in < 60 seconds (SC-001); static pages load instantly from bundle
**Constraints**: Offline-first (Constitution III); $100/month cost ceiling (Constitution V); OWASP Top 10 compliance; GDPR right to erasure
**Scale/Scope**: Personal-scale (tens to hundreds of documents per user); no pagination needed for deletion query

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **I. Encounter-First** — This feature adds no vocabulary, curricula, or app-assigned
  content. It does not interact with the vocabulary data model at all (other than deleting it
  on request). Fully compliant.
- ✅ **II. Learner Ownership** — The deletion feature is the ultimate expression of learner
  ownership: the user can erase all their data at will. Static pages add no AI-generated or
  auto-filled content. Fully compliant.
- ✅ **III. Offline-First** — Privacy Policy and T&C pages are embedded in the JS bundle
  and available offline. The account deletion action requires connectivity (server-side
  deletion), which is correct — you cannot delete cloud data while offline. The offline
  constraint applies to core vocabulary features, not to account management operations
  that are inherently server-dependent.
- ✅ **IV. AI as Assistant** — This feature makes zero AI calls. Fully compliant.
- ✅ **V. Cost-Conscious** — One new Azure Function (`DELETE /api/account`) that only executes
  once per user lifetime. The Cosmos query + N individual deletes cost a trivial number of
  RUs (< 100 RU total for a typical user). Zero ongoing cost impact. Fully compliant.

## Project Structure

### Documentation (this feature)

```text
specs/004-privacy-compliance/
├── plan.md              ← this file
├── research.md          ← Phase 0 complete
├── data-model.md        ← Phase 1 complete
├── quickstart.md        ← Phase 1 complete
├── contracts/
│   └── DELETE-account.md  ← Phase 1 complete
└── tasks.md             ← Phase 2 output (via /speckit.tasks — not yet created)
```

### Source Code (changes in this feature)

```text
api/
└── src/
    ├── functions/
    │   └── account.ts        ← NEW: DELETE /api/account handler
    └── services/
        ├── cosmos.ts         ← MODIFIED: add deleteAllForPartition()
        └── cosmos.mock.ts    ← MODIFIED: add deleteAllForPartition()

frontend/
└── src/
    ├── main.tsx              ← MODIFIED: add /privacy and /terms public routes
    ├── components/
    │   └── layout/
    │       ├── AppShell.tsx            ← MODIFIED: add <footer> with Privacy + T&C links
    │       ├── AppShell.module.css     ← MODIFIED: footer styles
    │       ├── UserMenu.tsx            ← MODIFIED: Delete Account button + confirmation dialog
    │       └── UserMenu.module.css     ← MODIFIED: danger button + dialog styles
    ├── pages/
    │   ├── PrivacyPolicy.tsx           ← NEW: Privacy Policy page
    │   ├── PrivacyPolicy.module.css    ← NEW: styles
    │   ├── Terms.tsx                   ← NEW: Terms & Conditions page
    │   ├── Terms.module.css            ← NEW: styles
    │   └── Login.tsx                   ← MODIFIED: add T&C + Privacy footer links
    └── services/
        ├── api.ts            ← MODIFIED: add deleteAccount()
        └── db.ts             ← MODIFIED: add clearLocalData()
```

**Structure Decision**: Option 2 (web application — frontend SPA + serverless API).
Follows the established `frontend/` + `api/` project separation used throughout the repo.

## Complexity Tracking

No constitution violations. All five principles are satisfied. No complexity justification required.
