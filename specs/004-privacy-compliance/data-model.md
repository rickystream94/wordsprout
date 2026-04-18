# Data Model: Privacy & Compliance

**Branch**: `004-privacy-compliance` | **Date**: 2026-04-18

---

## 1. No New Persistent Entities

This feature introduces **no new database entities** and **no schema migrations**.

The deletion feature operates exclusively on existing entity types:

| Entity | Store | Action on account deletion |
|--------|-------|---------------------------|
| `User` | Cosmos DB | DELETE — point-read by userId, then delete |
| `AllowList` | Cosmos DB | DELETE — point-read by userId (id = userId), then delete |
| `Phrasebook` | Cosmos DB | DELETE — query all by userId + type = 'phrasebook', then delete each |
| `VocabularyEntry` | Cosmos DB | DELETE — query all by userId + type = 'entry', then delete each |
| `AIEnrichment` | Cosmos DB | DELETE — query all by userId + type = 'enrichment', then delete each |
| `DBPhrasebook` | Dexie (local) | CLEAR — Dexie.delete('wordsprout') drops entire DB |
| `DBEntry` | Dexie (local) | CLEAR — covered by Dexie.delete('wordsprout') |
| `DBEnrichment` | Dexie (local) | CLEAR — covered by Dexie.delete('wordsprout') |
| `DBPendingMutation` | Dexie (local) | CLEAR — covered by Dexie.delete('wordsprout') |
| `DBMeta` | Dexie (local) | CLEAR — covered by Dexie.delete('wordsprout') |

---

## 2. API Layer Change — CosmosClientWrapper Extension

The `CosmosClientWrapper` interface in `api/src/services/cosmos.ts` gains one new method:

```typescript
/** Delete all documents for a given partition key (userId). Returns the count deleted. */
deleteAllForPartition(partitionKey: string): Promise<number>;
```

### Implementation detail
Executes a lightweight projection query to get all `{id}` values in the partition, then
calls `deleteItem` for each. The query retrieves only the `id` field to minimise RU cost.

```sql
SELECT c.id FROM c WHERE c.userId = @userId
```

No Cosmos change-feed, stored procedures, or bulk executor are needed.

### Mock implementation
`cosmos.mock.ts` receives the same method. It iterates the in-memory store and deletes
all entries where `doc.userId === partitionKey`, then persists the reduced store.

---

## 3. State Transitions — Account Deletion Flow

```
[Signed In]
    │ user clicks "Delete Account"
    ▼
[Confirmation Dialog Shown]
    │ user cancels → [Signed In] (no change)
    │ user confirms
    ▼
[Deletion In Progress]
    │ DELETE /api/account called
    │ success
    ▼
[Server Data Deleted]
    │ Dexie.delete('wordsprout')
    │ logout()
    ▼
[Signed Out — redirected to /login]

    │ (on error at any step)
    ▼
[Error State — user informed, retry available]
    │ user retries → [Deletion In Progress]
    │ user dismisses → [Signed In] (no local data cleared, server data state unknown)
```

---

## 4. New Frontend State (UserMenu component)

The `UserMenu` component gains a local UI state machine:

| State | Description |
|-------|-------------|
| `idle` | Normal dropdown; shows Sign Out and Delete Account buttons |
| `confirming` | Confirmation dialog visible; awaiting user choice |
| `deleting` | Deletion in progress; spinner shown, buttons disabled |
| `error` | Server-side deletion failed; error message shown with retry option |

These are transient UI states only — not persisted to any store.

---

## 5. Privacy Policy and Terms Pages — Data Model

These pages are **content-only** — no database reads, no state, no API calls.

Content is embedded as static JSX in React components. The pages are:
- `frontend/src/pages/PrivacyPolicy.tsx`
- `frontend/src/pages/Terms.tsx`

Both are pure presentational components with no props, no context dependencies
(except optional theme for dark-mode support), and no side effects.

---

## 6. Validation Rules

| Entity | Rule |
|--------|------|
| Account deletion request | Must be authenticated (valid JWT via `authorise()`) |
| Account deletion scope | Only documents where `userId === token.sub` are deleted |
| Account deletion idempotency | Calling delete twice is safe — individual `deleteItem` calls are already 404-tolerant |
