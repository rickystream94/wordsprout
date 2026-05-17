# API Contracts: Learning Score Decay

**Phase 1 output** | Branch: `feature/008-learning-score-decay` | Date: 2026-05-17

---

## No new API endpoints

This feature does not introduce any new HTTP endpoints.

---

## Reused endpoint: `PUT /api/entries/:id`

Decay updates are synced to the server via the existing entry update endpoint, through the `enqueueMutation` offline queue. The endpoint already supports partial `learningScore` updates.

### Request

```
PUT /api/entries/:id
Authorization: Bearer <access_token>
Content-Type: application/json
```

```jsonc
{
  "learningScore": 95   // updated decayed score (integer 0–100)
  // lastReviewedDate is intentionally omitted — decay does not change the review date
  // updatedAt is set by the server from the existing document
}
```

### Server behaviour (existing, unchanged)

- `lastReviewedDate`: If absent from the request body, the server preserves the existing value from Cosmos DB (`existing.lastReviewedDate`).
- `learningScore`: Validated as an integer in range [0–100].
- Returns `200 OK` with the full updated entry document.

### Response

```jsonc
{
  "id": "uuid",
  "userId": "string",
  "phrasebookId": "uuid",
  "learningScore": 95,
  "lastReviewedDate": "2026-05-03",  // unchanged from server record
  "updatedAt": "2026-05-17T...",
  // ... other entry fields unchanged
}
```

---

## Sync queue behaviour

Decay mutations are enqueued via `enqueueMutation` in `sync.ts` — the same mechanism used by `FlashcardSession` score updates. While offline, changes are held in `db.pendingSync` and replayed on the next successful network event.

Each changed entry generates one `PUT` mutation. If the user has 200 entries and 50 need decay, 50 mutations are enqueued. This is consistent with existing behaviour for review sessions.
