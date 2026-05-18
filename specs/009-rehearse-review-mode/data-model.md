# Data Model: Rehearse Review Mode

**Phase 1 output** | Branch: `feature/009-rehearse-review-mode` | Date: 2026-05-18

---

## Schema Changes

**No schema migrations required.** This feature introduces no new Dexie tables, no new IndexedDB stores, and no new Azure Cosmos DB collections or document fields. All required data already exists in `DBEntry` and `DBEnrichment`.

---

## Existing Entities Used (read-only)

### `DBEntry` — used as-is

All fields read during a rehearse session. No fields added or removed.

| Field | Type | Used in rehearse |
|---|---|---|
| `id` | `string` | Enrichment lookup key |
| `sourceText` | `string` | Primary display — large heading |
| `targetText` | `string \| undefined` | Primary display — large subheading |
| `notes` | `string \| undefined` | Displayed if present |
| `tags` | `string[]` | Displayed as chips; used for filtering |
| `partOfSpeech` | `PartOfSpeech \| undefined` | Displayed; used for filtering |
| `learningScore` | `number` | Used only by "prioritise low score" strategy; **never written** |
| `lastReviewedDate` | `string \| null` | Not displayed; not written |
| `decayBaseScore` | `number \| null` | Not used |
| `phrasebookId` | `string` | Pool scoping |
| `userId` | `string` | Pool scoping |

### `DBEnrichment` — used as-is

All enrichment fields displayed when present. No fields added or removed.

| Field | Type | Display label |
|---|---|---|
| `exampleSentences` | `string[]` | "Example sentences" |
| `synonyms` | `string[]` | "Synonyms" |
| `antonyms` | `string[]` | "Antonyms" |
| `collocations` | `string[]` | "Collocations" |
| `register` | `string \| undefined` | "Register" |
| `falseFriendWarning` | `string \| undefined` | "⚠ False friend" |

---

## New In-Memory Types (no persistence)

These types exist only during an active rehearse session and are not persisted anywhere.

### `RehearseSessionConfig`

```ts
// frontend/src/components/review/RehearseSession.tsx
// Props only — never written to IndexedDB
interface RehearseSessionConfig {
  entries: DBEntry[];          // Pre-filtered, pre-sized pool from getEntriesForRehearsal
  enrichments: DBEnrichment[]; // Loaded once at session start; keyed by entryId
}
```

### `ReviewMode`

New union type added to `SessionSetup.tsx` (co-located export):

```ts
// frontend/src/components/review/SessionSetup.tsx
export type ReviewMode = 'competitive' | 'rehearse';
```

---

## New Service Function

### `getEntriesForRehearsal`

Added to `frontend/src/services/db.ts`.

```ts
export async function getEntriesForRehearsal(
  userId: string,
  type: 'random' | 'targeted',
  size: number,
  phrasebookId: string,
  posFilter: PartOfSpeech[],   // empty array = no PoS filter
  tagFilter: string[],          // empty array = no tag filter
): Promise<DBEntry[]>
```

**Query plan**:
1. `db.entries.where('userId').equals(userId).toArray()` → all user entries
2. Filter by `phrasebookId`
3. Apply `posFilter`: include only entries where `entry.partOfSpeech` is in the array (skipped if empty)
4. Apply `tagFilter`: include only entries where at least one of `entry.tags` is in the array (skipped if empty)
5. If `type === 'targeted'`: sort ascending by `learningScore` and take first `size`
6. If `type === 'random'`: apply Fisher-Yates shuffle, take first `size`
7. Returns filtered + sized `DBEntry[]`

**No DB writes occur in this function.**

---

## Helper Function

### `getAvailableTagsForPhrasebook`

New helper for populating the tag filter multiselect in `SessionSetup`:

```ts
export async function getAvailableTagsForPhrasebook(
  userId: string,
  phrasebookId: string,
): Promise<string[]>
```

**Implementation**: Queries entries for user + phrasebook, flattens all `tags` arrays, de-duplicates, sorts alphabetically.

---

## No API Contract Changes

This feature is entirely client-side. The Azure Functions API is not called during any rehearse session interaction. The existing `openapi.yaml` contract (from spec 002) is unchanged.
