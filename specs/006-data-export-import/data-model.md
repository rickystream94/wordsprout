# Data Model: Data Export & Import

**Phase 1 output** | **Branch**: `006-data-export-import`

---

## Overview

This feature introduces one new composite type — the **ExportPackage** — and a small addition to the existing **User** document. No new Cosmos DB containers or IndexedDB tables are created.

---

## 1. ExportPackage

The ExportPackage is the JSON structure written to the user's device on export and read back during import. It is never stored in Cosmos DB or IndexedDB; it exists only as a file on the user's device.

### 1.1 Top-Level Structure

```typescript
interface ExportPackage {
  schemaVersion: 1;          // Integer discriminant; literal type 1 for this version
  app: 'wordsprout';         // Constant identifier to distinguish from other apps' exports
  exportedAt: string;        // ISO 8601 UTC timestamp of export generation
  data: ExportData;
}

interface ExportData {
  phrasebooks: ExportPhrasebook[];
  entries:     ExportEntry[];
  enrichments: ExportEnrichment[];
}
```

**Mandatory top-level fields**: `schemaVersion`, `app`, `exportedAt`, `data`

---

### 1.2 ExportPhrasebook

Derived from the existing `Phrasebook` type in `api/src/models/types.ts`. The `userId` field is **stripped** from the export (security: the file does not contain the user's identity; userId is re-assigned from the JWT on import).

```typescript
interface ExportPhrasebook {
  // ── Mandatory ──────────────────────────────────────────────────────────────
  id:                 string;  // UUID; preserved from the original document
  name:               string;  // Phrasebook display name
  sourceLanguageCode: string;  // ISO 639-1 (e.g. "en")
  targetLanguageCode: string;  // ISO 639-1 (e.g. "fr")
  createdAt:          string;  // ISO 8601
  updatedAt:          string;  // ISO 8601

  // ── Optional ───────────────────────────────────────────────────────────────
  sourceLanguageName?: string; // Human-readable language name (e.g. "English")
  targetLanguageName?: string; // Human-readable language name (e.g. "French")
  entryCount?:         number; // Cached count; recalculated on import from actual entries
  fromTemplate?:       boolean;
}
```

**Mandatory on import**: `id`, `name`, `sourceLanguageCode`, `targetLanguageCode`
**Optional on import** (consistent with `POST /phrasebooks` UI validation): `sourceLanguageName`, `targetLanguageName`, `entryCount`, `fromTemplate`

---

### 1.3 ExportEntry

Derived from the existing `VocabularyEntry` type. `userId` and `type` are stripped from the export.

```typescript
interface ExportEntry {
  // ── Mandatory ──────────────────────────────────────────────────────────────
  id:             string;        // UUID; preserved
  phrasebookId:   string;        // Must reference an id present in data.phrasebooks
  sourceText:     string;        // Primary vocabulary term (non-empty after trim)
  createdAt:      string;        // ISO 8601
  updatedAt:      string;        // ISO 8601

  // ── Optional ───────────────────────────────────────────────────────────────
  targetText?:        string;          // Translation
  notes?:             string;          // User annotations
  tags:               string[];        // Default: [] if absent
  partOfSpeech?:      PartOfSpeech;    // Enum — see existing type definition
  learningScore?:     number;          // 0–100; default: 0 if absent
  lastReviewedDate?:  string | null;   // 'YYYY-MM-DD' or null; default: null if absent
  enrichmentId?:      string;          // Reference to an ExportEnrichment; not validated
}
```

**Mandatory on import**: `id`, `phrasebookId`, `sourceText`
**Optional on import** (consistent with `POST /entries` UI validation): all other fields
**Referential integrity check on import**: `phrasebookId` must match an `id` in `data.phrasebooks`

---

### 1.4 ExportEnrichment

Derived from `AIEnrichment`. `userId` and `type` are stripped.

```typescript
interface ExportEnrichment {
  // ── Mandatory ──────────────────────────────────────────────────────────────
  id:               string;    // UUID; preserved
  entryId:          string;    // Must reference an id present in data.entries
  createdAt:        string;    // ISO 8601
  updatedAt:        string;    // ISO 8601

  // ── Optional (all enrichment content fields are optional) ─────────────────
  exampleSentences?: string[];
  synonyms?:         string[];
  antonyms?:         string[];
  collocations?:     string[];
  register?:         string;
  falseFriendWarning?: string;
  generatedAt?:      string;
  editedAt?:         string;
}
```

**Mandatory on import**: `id`, `entryId`
**Optional on import**: all content fields
**Note**: enrichments whose `entryId` does not match any entry in `data.entries` are silently skipped (defensive import — orphan enrichments are harmless to drop).

---

## 2. User Document Modification

One new optional field is added to the existing `User` type:

```typescript
interface User extends CosmosDocument {
  // ... existing fields unchanged ...
  lastImportAt?: string;  // ISO 8601 — timestamp of the last successful import; used for rate limiting
}
```

This field is set by the import handler after a successful import and checked at the start of each import request. No migration is required (the field is optional and absent for existing users).

---

## 3. Validation Rules

### 3.1 Client-Side Validation (fail-fast, before upload)

| Check | Failure Behaviour |
|-------|------------------|
| File extension is `.json` **or** MIME type is `application/json` / `text/plain` | Reject with "Only JSON files are accepted" |
| File size ≤ 10 MB | Reject with "File is too large (maximum 10 MB)" |
| `JSON.parse()` succeeds | Reject with "File is not valid JSON" |
| Root object has `schemaVersion`, `app`, `exportedAt`, `data` keys | Reject with "File does not appear to be a WordSprout backup" |
| `schemaVersion === 1` | Reject with "This backup was created with a newer version of WordSprout. Please update the app and try again." |
| `app === 'wordsprout'` | Reject with "File does not appear to be a WordSprout backup" |
| `data.phrasebooks` and `data.entries` are arrays | Reject with "Backup file has an unexpected structure" |

### 3.2 Server-Side Validation (authoritative)

| Check | HTTP Status | Error Message |
|-------|-------------|---------------|
| `Content-Length` header ≤ 10 MB | 413 | "Request body exceeds the maximum allowed size of 10 MB" |
| `JSON.parse()` succeeds | 400 | "Request body is not valid JSON" |
| Top-level schema check (same as client-side) | 422 | "Invalid backup file structure" |
| `schemaVersion === 1` | 422 | "Unsupported schema version. Only version 1 is supported." |
| Rate limit: `lastImportAt` older than 5 minutes (or absent) | 429 | "Import rate limit exceeded. Please wait 5 minutes before importing again." |
| Each phrasebook has non-empty `name`, `sourceLanguageCode`, `targetLanguageCode` | 422 | "One or more phrasebooks are missing required fields (name, sourceLanguageCode, targetLanguageCode)" |
| Each entry has non-empty `sourceText` and `phrasebookId` | 422 | "One or more entries are missing required fields (sourceText, phrasebookId)" |
| Each entry's `phrasebookId` references a phrasebook in the package | 422 | "One or more entries reference a phrasebook that is not in this backup" |

### 3.3 Sanitisation (server-side, after validation)

DOMPurify (`isomorphic-dompurify`) is applied to all `string` fields in the import payload before writing to Cosmos DB. This includes:

- `Phrasebook`: `name`, `sourceLanguageName`, `targetLanguageName`
- `Entry`: `sourceText`, `targetText`, `notes`, each element of `tags`
- `Enrichment`: each element of `exampleSentences`, `synonyms`, `antonyms`, `collocations`, `register`, `falseFriendWarning`

Fields set server-side and never taken from the client file: `userId`, `type`.

---

## 4. Export File Naming

The downloaded file is named using the pattern:

```
wordsprout-backup-YYYY-MM-DD.json
```

Where `YYYY-MM-DD` is the local date on the user's device at the time of export.

**Example**: `wordsprout-backup-2026-05-16.json`

---

## 5. Import Response

The `POST /data/import` endpoint returns HTTP 200 on success with a body of:

```typescript
interface ImportResult {
  phrasebooksImported: number;
  entriesImported:     number;
  enrichmentsImported: number;
  phrasebooks:         Phrasebook[];    // Full server-canonical Phrasebook documents
  entries:             VocabularyEntry[];  // Full server-canonical VocabularyEntry documents
  enrichments:         AIEnrichment[];    // Full server-canonical AIEnrichment documents
}
```

The full document arrays allow the client to re-populate IndexedDB exactly from the server response without a separate pull round-trip.
