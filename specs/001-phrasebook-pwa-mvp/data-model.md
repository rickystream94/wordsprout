# Data Model: WordSprout MVP — 001-phrasebook-pwa-mvp

**Phase**: 1 — Design
**Date**: 2026-04-12
**Storage**: Azure Cosmos DB Serverless (server-side) + Dexie.js / IndexedDB (client-side)
**Container strategy**: Single container, partition key `/userId`, type discriminator `type`

---

## Design Principles

- Every document includes `id` (UUID v4), `userId`, `type`, `createdAt`, `updatedAt`.
- `updatedAt` is used by the sync replay queue to detect staleness (last-write-wins).
- Client IndexedDB schema mirrors server schema fields; no separate client-only fields
  except `syncStatus` (`"synced" | "pending" | "failed"`) and `retryCount`.
- All text fields that accept user input are sanitised before storage (DOMPurify, empty
  tag allowlist).
- AI-generated fields are stored as-is after sanitisation; user edits overwrite them.

---

## Entities

### User

Represents an authenticated, allow-listed learner. Created server-side on first successful
authenticated request after allow-list verification. Not stored client-side beyond the
decoded JWT claims.

**Cosmos DB document**

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Same as `userId` for point-reads |
| `userId` | string | OAuth subject (`sub` claim from B2C token) |
| `type` | `"user"` | Type discriminator |
| `email` | string | From OAuth claims; stored for admin reference |
| `displayName` | string | From OAuth claims |
| `aiQuotaUsedToday` | number | Count of AI enrichment calls today |
| `aiQuotaResetAt` | string (ISO 8601) | Timestamp when quota resets (midnight UTC) |
| `createdAt` | string (ISO 8601) | |
| `updatedAt` | string (ISO 8601) | |

**Notes**: `aiQuotaUsedToday` is incremented server-side and reset when `aiQuotaResetAt`
is in the past. The daily limit value is a server-side configuration constant, not stored
per user.

---

### Phrasebook

A named language-pair container owned by a user. One user may have many phrasebooks.

**Cosmos DB document**

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | |
| `userId` | string | Partition key |
| `type` | `"phrasebook"` | |
| `name` | string | User-chosen name; max 100 chars |
| `sourceLanguageCode` | string | ISO 639-1 code, e.g. `"it"` |
| `sourceLanguageName` | string | Display name, e.g. `"Italian"` |
| `targetLanguageCode` | string | ISO 639-1 code, e.g. `"en"` |
| `targetLanguageName` | string | Display name, e.g. `"English"` |
| `createdAt` | string (ISO 8601) | |
| `updatedAt` | string (ISO 8601) | |

**Client IndexedDB (Dexie)**

Same fields plus:

| Field | Type | Notes |
|---|---|---|
| `syncStatus` | `"synced" \| "pending" \| "failed"` | |
| `retryCount` | number | Incremented on failed sync attempt |

**Validation rules**:
- `name`: required, non-empty, max 100 chars, sanitised.
- `sourceLanguageCode` / `targetLanguageCode`: must be a valid ISO 639-1 code from the
  bundled language list; source and target may be the same (edge case: monolingual notes).

---

### VocabularyEntry

The core entity. Belongs to exactly one phrasebook.

**Cosmos DB document**

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | |
| `userId` | string | Partition key |
| `type` | `"vocabulary_entry"` | |
| `phrasebookId` | string | Foreign key to Phrasebook |
| `sourceText` | string | Expression in source language; required; max 500 chars |
| `targetText` | string | Expression in target language; optional; max 500 chars |
| `notes` | string | Free-form notes; optional; max 2,000 chars |
| `tags` | string[] | Free-form tag strings; max 20 tags; each max 50 chars |
| `partOfSpeech` | string \| null | One of the allowed PoS values (see below) or `null` |
| `learningState` | string | `"new"` \| `"learning"` \| `"mastered"` |
| `enrichmentId` | string \| null | FK to AIEnrichment document, or `null` |
| `createdAt` | string (ISO 8601) | |
| `updatedAt` | string (ISO 8601) | |

**Part-of-speech allowed values**: `"noun"`, `"verb"`, `"adjective"`, `"adverb"`,
`"idiom"`, `"phrasal_verb"`, `"other"`, `null`

**Client IndexedDB (Dexie)** — same fields plus `syncStatus`, `retryCount`.

**Validation rules**:
- `sourceText`: required, non-empty, max 500 chars, sanitised.
- `targetText`: optional, max 500 chars, sanitised.
- `notes`: optional, max 2,000 chars, sanitised.
- `tags`: each tag sanitised; duplicates collapsed server-side.
- `partOfSpeech`: must be one of the allowed values or null.
- `learningState`: must be one of `"new"`, `"learning"`, `"mastered"`; defaults to `"new"`.

---

### AIEnrichment

AI-generated enrichment content for a single VocabularyEntry. Created on demand and
attached to the entry via `enrichmentId`. All fields are independently editable by the
user; edits supersede the generated values.

**Cosmos DB document**

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | |
| `userId` | string | Partition key |
| `type` | `"ai_enrichment"` | |
| `entryId` | string | FK to VocabularyEntry |
| `exampleSentences` | string[] \| null | AI-generated, editable |
| `synonyms` | string[] \| null | AI-generated, editable |
| `antonyms` | string[] \| null | AI-generated, editable |
| `register` | string \| null | e.g. `"formal"`, `"informal"`, `"neutral"` |
| `collocations` | string[] \| null | AI-generated, editable |
| `falseFriendWarning` | string \| null | AI-generated, editable |
| `generatedAt` | string (ISO 8601) | When AI call was made |
| `editedAt` | string \| null (ISO 8601) | Set when user edits any field |
| `createdAt` | string (ISO 8601) | |
| `updatedAt` | string (ISO 8601) | |

**Notes**: All string fields are sanitised before storage (both AI-generated and after user
edits). The `editedAt` field signals that the record has been modified from the raw AI
output; no separate "original" copy is retained.

---

### AccessRequest

A prospective user's request to join the private preview. Created via an unauthenticated
endpoint. Not scoped to a userId partition (user does not yet exist).

**Cosmos DB document**

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | |
| `userId` | `"_access_requests"` | Fixed value for partition; not a real user |
| `type` | `"access_request"` | |
| `email` | string | Sanitised; max 254 chars |
| `requestedAt` | string (ISO 8601) | |
| `status` | `"pending" \| "approved" \| "rejected"` | |
| `createdAt` | string (ISO 8601) | |
| `updatedAt` | string (ISO 8601) | |

**Validation rules**:
- `email`: required, must match RFC 5322 email pattern (server-side), sanitised, max 254
  chars.
- Rate-limited on the endpoint level to prevent abuse (FR-037).

---

### AllowList

Not exposed via the user-facing API. Managed directly in Cosmos DB by the product owner.
Enables the `authorise()` utility to perform a point-read per authenticated user.

**Cosmos DB document**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Same as `userId` for efficient point-read |
| `userId` | string | Partition key; matches OAuth `sub` claim |
| `type` | `"allowlist"` | |
| `email` | string | For operator reference |
| `approvedAt` | string (ISO 8601) | |
| `createdAt` | string (ISO 8601) | |

---

## Client-Side IndexedDB Schema (Dexie.js)

```
Database: "WordSprout"

Table: phrasebooks
  ++id, userId, name, sourceLanguageCode, targetLanguageCode,
  createdAt, updatedAt, syncStatus, retryCount

Table: entries
  ++id, userId, phrasebookId, sourceText, targetText, notes,
  *tags, partOfSpeech, learningState, enrichmentId,
  createdAt, updatedAt, syncStatus, retryCount

Table: enrichments
  ++id, userId, entryId,
  createdAt, updatedAt, syncStatus, retryCount
  [all enrichment fields as JSON blob]

Table: pendingSync
  ++localId, id, type, operation ("create"|"update"|"delete"),
  payload, queuedAt, retryCount

Table: meta
  key, value   [stores: lastSyncAt, currentUserId]
```

**Indexes**:
- `entries`: compound index on `[userId+phrasebookId]` for fast per-phrasebook listing.
- `entries`: individual indexes on `partOfSpeech`, `learningState` for filter queries.
- `entries.tags` uses the Dexie multi-entry index (`*tags`) to support tag-based key-range
  queries (exact tag match). Full-text tag search goes through MiniSearch.

---

## Entity Relationships

```
User
 └── (1:N) Phrasebook
              └── (1:N) VocabularyEntry
                          └── (0:1) AIEnrichment

AccessRequest  (no User FK — pre-auth entity)
AllowList      (no User FK — admin-only)
```

---

## State Transitions

### VocabularyEntry.learningState

```
new ──────────► learning ──────────► mastered
  ◄────────────           ◄──────────
         (user-controlled; any transition is valid in any direction)
```

### SyncStatus (client-side only)

```
pending ──(online + API call succeeds)──► synced
pending ──(API call fails, retries < 3)──► pending (retryCount++)
pending ──(retries ≥ 3)──────────────────► failed
```

---

## ISO 639-1 Language List

Bundled as a static JSON asset in the frontend (`public/languages.json`). Format:

```json
[
  { "code": "it", "name": "Italian" },
  { "code": "en", "name": "English" },
  { "code": "da", "name": "Danish" },
  ...
]
```

~180 entries. No network call required to populate the language picker.
Also exposed via `GET /api/languages` for server-side validation of incoming requests.
