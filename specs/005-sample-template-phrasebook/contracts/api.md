# API Contracts: Sample Template Phrasebook

**Feature**: 005-sample-template-phrasebook
**Base URL**: `/api`

This feature modifies one existing endpoint and adds no new endpoints.
All template phrasebook generation is performed client-side; the API simply receives
the resulting phrasebook and entry documents via existing endpoints.

---

## Modified: `POST /phrasebooks`

### Change

Adds server-side duplicate language pair validation (FR-011).

### Request

```http
POST /api/phrasebooks
Authorization: Bearer <session-token>
Content-Type: application/json
```

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "English → Spanish Starter",
  "sourceLanguageCode": "en",
  "sourceLanguageName": "English",
  "targetLanguageCode": "es",
  "targetLanguageName": "Spanish",
  "fromTemplate": true
}
```

**New field**: `fromTemplate` (boolean, optional) — stored as-is on the created document.

### Responses

#### `201 Created` — phrasebook created

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-sub-id",
  "type": "phrasebook",
  "name": "English → Spanish Starter",
  "sourceLanguageCode": "en",
  "sourceLanguageName": "English",
  "targetLanguageCode": "es",
  "targetLanguageName": "Spanish",
  "entryCount": 0,
  "fromTemplate": true,
  "createdAt": "2026-05-15T12:00:00.000Z",
  "updatedAt": "2026-05-15T12:00:00.000Z"
}
```

#### `409 Conflict` — duplicate language pair (NEW)

Returned when the authenticated user already has a phrasebook with the same
`sourceLanguageCode` + `targetLanguageCode` combination.

```json
{
  "error": "Conflict",
  "message": "You already have a phrasebook for English → Spanish.",
  "statusCode": 409
}
```

#### `400 Bad Request` — unchanged (missing required fields)

```json
{
  "error": "Bad Request",
  "message": "name, sourceLanguageCode, and targetLanguageCode are required",
  "statusCode": 400
}
```

#### `401 Unauthorized` — unchanged

---

## Unchanged Endpoints Used by This Feature

The following existing endpoints are consumed during template generation without modification:

| Method | Path | Usage |
|--------|------|-------|
| `POST` | `/api/entries` | Sync one vocabulary entry (called 50 times via mutation queue) |
| `POST` | `/api/enrichments` | Sync one enrichment (called 50 times via mutation queue) |
| `GET` | `/api/phrasebooks` | Used by client duplicate-check (list already loaded via Dexie) |

---

## Client-Side Contract: `generateTemplatePhrasebook()`

This is the primary new service function exposed to UI components. It is **not** an HTTP endpoint — it is a frontend TypeScript service function.

```ts
/**
 * Generate a template phrasebook for the given target language.
 * Writes all documents to IndexedDB and enqueues sync mutations.
 *
 * @throws {DuplicateLanguagePairError} if a phrasebook for this language pair already exists
 */
async function generateTemplatePhrasebook(
  userId: string,
  targetCode: TemplateLanguageCode,
): Promise<DBPhrasebook>
```

**Behaviour**:
1. Checks existing phrasebooks via Dexie. Throws `DuplicateLanguagePairError` if `(en, targetCode)` already exists.
2. Constructs `DBPhrasebook` with `fromTemplate: true`, `sourceLanguageCode: 'en'`, `entryCount: 50`.
3. Constructs 50 `DBEntry` objects and 50 `DBEnrichment` objects from `TEMPLATE_ENTRIES`.
4. Writes all 101 documents to IndexedDB in a single Dexie transaction.
5. Enqueues 101 sync mutations: 1× `POST /phrasebooks` + 50× `POST /entries` + 50× `POST /enrichments`.
6. Returns the created `DBPhrasebook`.
