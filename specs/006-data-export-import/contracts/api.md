# API Contracts: Data Export & Import

**Phase 1 output** | **Branch**: `006-data-export-import`

---

## Overview

Export is entirely client-side (no new API endpoint). Import introduces one new authenticated endpoint.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data/import` | `POST` | Import a full backup; replaces all user content |

---

## POST /api/data/import

### Purpose

Accepts a full WordSprout backup payload, validates and sanitises its content, atomically replaces all phrasebook/entry/enrichment documents for the authenticated user, and returns the canonical server-written dataset for client-side IndexedDB re-population.

### Authentication

Requires a valid Bearer token in the `Authorization` header. The `authenticated()` middleware validates the JWT and extracts `token.sub` (the user's identity).

### Rate Limiting

One import per 5 minutes per user. Checked against `User.lastImportAt` in Cosmos DB. Returns 429 if the limit is exceeded.

---

### Request

**Headers**

| Header | Required | Value |
|--------|----------|-------|
| `Authorization` | ✅ | `Bearer <JWT>` |
| `Content-Type` | ✅ | `application/json` |

**Body** — `ExportPackage` (as defined in [data-model.md](../data-model.md))

```json
{
  "schemaVersion": 1,
  "app": "wordsprout",
  "exportedAt": "2026-05-16T14:30:00.000Z",
  "data": {
    "phrasebooks": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Travel French",
        "sourceLanguageCode": "en",
        "sourceLanguageName": "English",
        "targetLanguageCode": "fr",
        "targetLanguageName": "French",
        "entryCount": 2,
        "createdAt": "2026-01-01T10:00:00.000Z",
        "updatedAt": "2026-01-15T08:00:00.000Z"
      }
    ],
    "entries": [
      {
        "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "phrasebookId": "550e8400-e29b-41d4-a716-446655440000",
        "sourceText": "hello",
        "targetText": "bonjour",
        "tags": ["greetings"],
        "learningScore": 40,
        "lastReviewedDate": "2026-05-10",
        "createdAt": "2026-01-02T09:00:00.000Z",
        "updatedAt": "2026-05-10T14:00:00.000Z"
      },
      {
        "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "phrasebookId": "550e8400-e29b-41d4-a716-446655440000",
        "sourceText": "thank you",
        "tags": [],
        "learningScore": 0,
        "lastReviewedDate": null,
        "createdAt": "2026-01-03T09:00:00.000Z",
        "updatedAt": "2026-01-03T09:00:00.000Z"
      }
    ],
    "enrichments": []
  }
}
```

**Size constraint**: Request body must not exceed 10 MB.

---

### Responses

#### 200 OK — Import successful

```json
{
  "phrasebooksImported": 1,
  "entriesImported": 2,
  "enrichmentsImported": 0,
  "phrasebooks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "auth0|123456",
      "type": "phrasebook",
      "name": "Travel French",
      "sourceLanguageCode": "en",
      "sourceLanguageName": "English",
      "targetLanguageCode": "fr",
      "targetLanguageName": "French",
      "entryCount": 2,
      "createdAt": "2026-01-01T10:00:00.000Z",
      "updatedAt": "2026-01-15T08:00:00.000Z"
    }
  ],
  "entries": [ "... full VocabularyEntry objects ..." ],
  "enrichments": []
}
```

The response arrays contain the canonical server-written documents (with `userId` and `type` fields added). The client uses these to re-populate IndexedDB without a separate pull.

---

#### 400 Bad Request — Malformed JSON body

```json
{
  "error": "Error",
  "message": "Request body is not valid JSON",
  "statusCode": 400
}
```

---

#### 401 Unauthorized — Missing or invalid JWT

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization token",
  "statusCode": 401
}
```

---

#### 413 Content Too Large — Body exceeds 10 MB

```json
{
  "error": "Error",
  "message": "Request body exceeds the maximum allowed size of 10 MB",
  "statusCode": 413
}
```

---

#### 422 Unprocessable Entity — Schema validation failure

Returned for any of the following conditions:
- Unknown or unsupported `schemaVersion`
- Missing required top-level fields
- Missing required fields on a phrasebook or entry
- Entry references a phrasebook not present in the package

```json
{
  "error": "Error",
  "message": "Unsupported schema version. Only version 1 is supported.",
  "statusCode": 422
}
```

```json
{
  "error": "Error",
  "message": "One or more entries are missing required fields (sourceText, phrasebookId)",
  "statusCode": 422
}
```

```json
{
  "error": "Error",
  "message": "One or more entries reference a phrasebook that is not in this backup",
  "statusCode": 422
}
```

---

#### 429 Too Many Requests — Rate limit exceeded

```json
{
  "error": "Error",
  "message": "Import rate limit exceeded. Please wait 5 minutes before importing again.",
  "statusCode": 429
}
```

---

### Server-Side Processing Order

The endpoint processes the import in the following strictly ordered steps. If any step fails, the operation halts immediately and returns the appropriate error — no data is written.

1. **Size check**: Read `Content-Length` header. If > 10 MB → 413.
2. **JSON parse**: Parse the request body. If parse fails → 400.
3. **Schema validation**: Validate top-level structure, `schemaVersion`, mandatory fields on all phrasebooks and entries, referential integrity for all entries. If any check fails → 422.
4. **Rate limit check**: Read `User.lastImportAt` from Cosmos. If within 5 minutes → 429.
5. **Sanitise**: Apply DOMPurify to all string fields across all three entity types.
6. **Delete existing content**: Query all documents of type `phrasebook`, `entry`, and `enrichment` in the user's partition; delete them all. (`User`, `AllowList`, `AccessRequest`, `RateLimitEntry` documents are NOT deleted.)
7. **Insert imported data**: Upsert all phrasebooks, entries, and enrichments with `userId = token.sub` and correct `type` values.
8. **Update rate limit**: Write `User.lastImportAt = now`. Upsert the User document.
9. **Return result**: Return `ImportResult` with counts and full canonical documents.

---

### Client-Side Flow

```
User selects file
  → Client validates: MIME type / extension, size ≤ 10 MB, JSON parse, top-level schema, schemaVersion
  → Client shows confirmation dialog with summary (N phrasebooks, M entries)
  → User confirms
  → Client sends POST /api/data/import with file content as JSON body
  → On 200:
      - Clear pendingSync queue (IndexedDB)
      - Clear phrasebooks, entries, enrichments tables (IndexedDB)
      - Populate from response phrasebooks/entries/enrichments arrays
      - Trigger rebuildIndex() for MiniSearch
      - Show success toast: "Imported N phrasebooks and M entries"
  → On any error:
      - Show user-facing error message
      - No IndexedDB state is modified
```

---

## Export (Client-Side, No API Endpoint)

Export is generated entirely in the browser from IndexedDB. The sequence is:

1. If online: call `pullFromServer()` and wait for completion (or a short timeout). If offline: skip.
2. Read all phrasebooks, entries, and enrichments from IndexedDB for the current user.
3. Construct an `ExportPackage` with `schemaVersion: 1`, `app: 'wordsprout'`, `exportedAt: new Date().toISOString()`.
4. Strip `userId` and `type` from each entity.
5. `JSON.stringify()` the package.
6. Create a `Blob` with `type: 'application/json'`.
7. Create an object URL, attach it to a hidden `<a>` element, set `download` attribute to `wordsprout-backup-YYYY-MM-DD.json`, and programmatically click it.
8. Revoke the object URL.

No server request is made. No API endpoint is called. The export is available offline.
