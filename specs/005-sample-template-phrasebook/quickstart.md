# Quickstart: Sample Template Phrasebook

**Feature**: 005-sample-template-phrasebook
**Branch**: `feature/005-sample-template-phrasebook`

---

## Prerequisites

- Node.js 20+ installed
- Repo cloned, dependencies installed (`npm install` in `frontend/` and `api/`)
- Local dev environment running (`./dev.ps1` or equivalent)

---

## What Gets Built

1. **`frontend/src/data/templatePhrasebooks.ts`** — Static module with 50 vocabulary entries × 10 languages, part-of-speech, tags, and enrichment data.
2. **`frontend/src/services/db.ts`** — Extended `DBPhrasebook` type (`fromTemplate` field) + `generateTemplatePhrasebook()` service function + duplicate-pair guard in `createPhrasebook()`.
3. **`frontend/src/components/phrasebook/TemplatePhrasebookWizard.tsx`** — New modal/inline wizard component for language selection and generation.
4. **`frontend/src/pages/Home.tsx`** — Updated `EmptyState` (template CTA as primary action) + "From template" button in the header for existing users.
5. **`api/src/models/types.ts`** — `Phrasebook.fromTemplate?: boolean` field added.
6. **`api/src/functions/phrasebooks.ts`** — `POST /phrasebooks` handler updated with duplicate language pair check (409 on conflict).

---

## Key Implementation Steps (implementation order)

### Step 1 — Static Data

Create `frontend/src/data/templatePhrasebooks.ts`. Define `TemplateEntry`, `TEMPLATE_ENTRIES` (50 entries), `TEMPLATE_LANGUAGES`, and the `getTemplateEntries(targetCode)` helper.

Verify: Import the module in a test and assert `TEMPLATE_ENTRIES.length === 50` and that every entry has a translation for all 10 language codes.

### Step 2 — Type Extensions

- `api/src/models/types.ts`: Add `fromTemplate?: boolean` to `Phrasebook`.
- `frontend/src/services/db.ts`: Add `fromTemplate?: boolean` to `DBPhrasebook`.

No Dexie schema migration required (no new indexed columns).

### Step 3 — Duplicate Guard (Frontend Service)

In `frontend/src/services/db.ts`:
- Update `createPhrasebook()` to check for an existing phrasebook with the same `(userId, sourceLanguageCode, targetLanguageCode)` before calling `db.phrasebooks.add()`.
- Add `generateTemplatePhrasebook(userId, targetCode)` that:
  1. Runs the duplicate guard.
  2. Generates all 101 IndexedDB records in one Dexie transaction (`db.transaction('rw', [db.phrasebooks, db.entries, db.enrichments, db.pendingSync], ...)`).
  3. Sets `fromTemplate: true`, `entryCount: 50` on the phrasebook record.
  4. Sets `learningScore: 0`, `lastReviewedDate: null` on all entry records.

### Step 4 — Duplicate Guard (API)

In `api/src/functions/phrasebooks.ts` `createPhrasebook` handler:
- After existing validation, query the user partition for `type: 'phrasebook'`.
- If any result has matching `sourceLanguageCode` + `targetLanguageCode`, return `apiError(409, 'You already have a phrasebook for …')`.

### Step 5 — TemplatePhrasebookWizard Component

Create `frontend/src/components/phrasebook/TemplatePhrasebookWizard.tsx`:
- Props: `{ onDone: (pb?: DBPhrasebook) => void; existingLanguageCodes: string[] }`.
- Renders: source language static display ("English") + 10-item target language picker with disabled options for codes in `existingLanguageCodes`.
- On confirm: calls `generateTemplatePhrasebook()`, shows a brief loading state, calls `onDone(pb)` on success.
- On cancel: calls `onDone(undefined)`.

### Step 6 — Home Page Updates

In `frontend/src/pages/Home.tsx`:
- Compute `existingTargetCodes` from `phrasebooks` live query (filter `sourceLanguageCode === 'en'`).
- `EmptyState`: add "Start from a template" as primary button, retain "Create empty phrasebook" as secondary.
- Header: add "From template" secondary button alongside "New Phrasebook".
- Show `TemplatePhrasebookWizard` when the template flow is triggered.

### Step 7 — PhrasebookCard Badge

In `frontend/src/pages/Home.tsx` `PhrasebookCard`:
- Conditionally render a `<span className={styles.templateBadge}>Starter</span>` when `phrasebook.fromTemplate === true`.

---

## Running Tests

```powershell
# Frontend unit tests
cd frontend
npx vitest run

# API unit tests
cd api
npx vitest run

# Type-check both
cd frontend; npx tsc --noEmit
cd api; npx tsc --noEmit
```

---

## Manual Verification Checklist

- [ ] New user (no phrasebooks): empty state shows "Start from a template" as primary action
- [ ] Selecting English → Spanish generates a phrasebook with exactly 50 entries
- [ ] All 50 entries have `learningScore === 0`
- [ ] All 50 entries have at least one tag
- [ ] All 50 entries have a non-empty `enrichment` with at least one example sentence
- [ ] The phrasebook card shows a "Starter" badge
- [ ] Attempting to generate English → Spanish a second time is blocked (language option disabled in picker)
- [ ] Attempting to create a manual phrasebook with English → Spanish (already used) is blocked with a clear message
- [ ] Existing user (with phrasebooks): "From template" button is visible in the header
- [ ] Template phrasebook entries are editable and deletable
- [ ] Sync queue receives exactly 101 mutations after offline generation; mutations replay correctly when online
