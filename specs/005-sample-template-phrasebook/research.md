# Research: Sample Template Phrasebook

**Phase 0 — All unknowns resolved**
**Branch**: `feature/005-sample-template-phrasebook`

---

## R-001: Constitution Principle I — Encounter-First Conflict

**Question**: Does providing 50 pre-curated vocabulary entries violate Principle I ("Encounter-First Learning")?

**Decision**: Justified violation — proceed with explicit opt-in constraint.

**Rationale**:
The constitution guards against the app *imposing* vocabulary (word-of-the-day push, mandatory curricula, background word assignment). This feature differs in two critical ways:
1. It is a single, explicit, user-initiated one-off action — the user actively navigates to the wizard and confirms generation.
2. The result is a fully mutable first-class phrasebook — every entry is immediately editable and deletable. No entry is locked.

The legitimate problem being solved: a new user who has never added a word has literally zero value from the app on day 1. The template is a bootstrapping mechanism for discoverability — not a substitute for the encounter-first model.

**Alternatives Considered**:
- "Guided first entry" — Walk the user through adding their first word manually. Rejected: does not solve the review-session richness problem (1–2 words is still a poor review experience).
- "Example/demo mode" — A read-only demo phrasebook. Rejected: user cannot immediately start learning from it; adds UI complexity for a non-persistent artefact.
- Do nothing — Rejected: high new-user abandonment risk before they experience review sessions.

**Constitution compliance gate**: Violation must be documented in the plan's Complexity Tracking table. Justification: opt-in only, fully mutable entries, no AI, no ongoing assignment.

---

## R-002: Duplicate Phrasebook Prevention — Enforcement Strategy

**Question**: How should the one-phrasebook-per-language-pair constraint (FR-011) be enforced? Which layer(s)?

**Decision**: Programmatic client-side check (primary) + server-side guard (secondary).

**Rationale**:
The app is offline-first. The client must be able to enforce the constraint without network access. A programmatic check against Dexie (query phrasebooks for matching `sourceLanguageCode` + `targetLanguageCode` before inserting) is the correct primary path.

The server-side guard handles concurrent online creation (race condition on two devices). The API `POST /phrasebooks` handler queries the user's partition for a matching language pair before upserting; returns HTTP 409 if a duplicate exists.

A Dexie compound unique index (`[userId+sourceLanguageCode+targetLanguageCode]`) was evaluated but rejected: compound unique indices in Dexie v4 are not enforced at the IDB level for compound keys — enforcement would still need to be programmatic. Adding the index would provide a query convenience but at the cost of a schema migration. The programmatic check is sufficient and avoids an unnecessary DB migration.

**Alternatives Considered**:
- Compound Dexie unique index — Rejected: no IDB-level uniqueness guarantee for compound keys; adds a schema migration for no additional safety.
- Client-only enforcement — Rejected: race condition possible on dual-device simultaneous creation; server guard needed for correctness.

---

## R-003: Static Template Vocabulary Data — Structure and Location

**Question**: How should the 50-word × 10-language static dataset be structured and where should it live?

**Decision**: Single TypeScript module at `frontend/src/data/templatePhrasebooks.ts`. Data expressed as a typed constant — no JSON file, no network request.

**Rationale**:
A TypeScript constant is tree-shakeable, type-checked at build time, and requires no asset loading. The data is small (~15–20 KB unminified) and accessed only when the user generates a template, so it does not meaningfully inflate the initial bundle. Exporting a typed structure keeps the data contract explicit and prevents silent type drift.

**Structure**:
```ts
interface TemplateEntry {
  sourceText: string;            // English
  partOfSpeech: PartOfSpeech;
  tags: string[];
  translations: Record<string, string>;  // ISO 639-1 code → translated text
  enrichment: {
    exampleSentences: string[];  // English example sentence
    synonyms: string[];
    collocations: string[];
  };
}

const TEMPLATE_ENTRIES: TemplateEntry[] = [ /* 50 entries */ ];

// Supported language codes for template generation
export const TEMPLATE_LANGUAGES: { code: string; name: string }[] = [ /* 10 entries */ ];

export function getTemplateEntries(targetCode: string): TemplateEntry[] { ... }
```

**Alternatives Considered**:
- JSON file in `public/` — Rejected: requires a fetch(), does not work offline without a service worker cache, loses type safety.
- Server-side API endpoint returning template data — Rejected: adds a network dependency to a generation flow that should be instant and offline-capable.
- Per-language JSON files — Rejected: 10 separate files adds complexity with no benefit at this data scale.

---

## R-004: Bulk Sync Enqueueing for Template Generation

**Question**: Generating a template creates 1 phrasebook + 50 entries. How should the sync queue be populated without breaking the existing mutation replay system?

**Decision**: Enqueue 101 individual mutations (1 POST /phrasebooks + 50 POST /entries + 50 POST /enrichments) in a single Dexie transaction, in sequence (phrasebook first, then entries, then enrichments).

**Rationale**:
The existing `enqueueMutation` function appends a pending sync record per mutation URL+method+body. The replay queue processes these in insertion order. Enqueueing phrasebook first, then all entries, then all enrichments, guarantees the server receives each parent document before its dependents. All 101 mutations are written atomically to IndexedDB in a single Dexie transaction so no partial state is left if the user navigates away mid-generation.

There is no need for a "batch create" API endpoint — the existing per-resource endpoints are sufficient and the 101 mutations will replay quickly on next sync.

**Alternatives Considered**:
- New batch API endpoint (POST /phrasebooks/:id/entries/batch) — Rejected: disproportionate API scope change for a frontend-only static generation step; sync system would need special handling.
- Lazy enqueueing (enqueue entries one-by-one on user navigation) — Rejected: partial sync state is confusing and could result in a phrasebook with 0 entries on the server.

---

## R-005: Template Badge — Visual Identification

**Question**: How should template-generated phrasebooks be visually identified (FR-010)?

**Decision**: Add `fromTemplate?: boolean` field to `DBPhrasebook` / `Phrasebook`. Render a small "Starter" badge/label in `PhrasebookCard` when `fromTemplate === true`.

**Rationale**:
A boolean flag is the simplest stable representation. The badge is purely presentational — it does not gate any functionality. The `PhrasebookCard` component already renders per-phrasebook metadata; adding a conditional `<span>` badge requires minimal new CSS.

The flag is preserved through sync: stored in Cosmos DB and round-tripped back to the client on pull.

**Alternatives Considered**:
- Separate `templatePhrasebooks` Dexie table — Rejected: needlessly splits the data model; phrasebooks are phrasebooks regardless of origin.
- Name suffix convention (e.g., "(Starter)") — Rejected: pollutes user-visible name, makes it harder to rename the phrasebook, not machine-readable.

---

## R-006: Supported Target Languages — Verification

**Question**: Are all 10 planned target languages present in `frontend/public/languages.json`?

**Decision**: All 10 confirmed present. ISO 639-1 codes: `es`, `pt`, `fr`, `de`, `it`, `ru`, `pl`, `nl`, `ro`, `hi`.

**Languages.json** covers 180+ ISO 639-1 languages; all 10 are included. The existing `PhrasebookForm` `LanguageSelector` already renders from this file. The template wizard can load the same file and filter to the 10 supported codes, or simply embed the 10-item list statically in `templatePhrasebooks.ts` (preferred — avoids loading the full language list for a constrained selector).

---

## R-007: Template Generation — UI Placement

**Question**: Where should the template generation option appear for new users vs. existing users?

**Decision**:
- **New users (empty state)**: Replace the current single "Create your first phrasebook" button with two sibling options — "Start from a template" (primary/prominent) and "Create empty phrasebook" (secondary/text link). The template option occupies the visual primary action slot.
- **Existing users**: Add a "From template" button alongside the existing "+ New Phrasebook" button in the page header. Lower visual weight (secondary styling) but always accessible.

**UI flow**: Clicking either "Start from a template" or "From template" opens a modal (or inline card) with:
1. A fixed source language display ("English")
2. A 10-item language picker for the target language. Already-used target languages are disabled with an explanatory tooltip ("You already have an English → Spanish phrasebook").
3. A "Generate" button (disabled until a target language is selected).
4. A brief description of what will be generated ("50 starter words with enrichments, ready for review").

**Alternatives Considered**:
- Dedicated `/template` route — Rejected: adds routing complexity; the wizard is a modal-style flow that fits inline on the Home page.
- Replacing the entire empty state with only the template option — Rejected: removes user agency; some users may prefer an empty phrasebook.
