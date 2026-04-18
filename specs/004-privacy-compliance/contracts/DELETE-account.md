# API Contract: DELETE /api/account

**Feature**: Privacy & Compliance (004)
**Date**: 2026-04-18

---

## Overview

Permanently deletes all server-side data associated with the currently authenticated user.
This endpoint implements the GDPR right to erasure (FR-004, FR-009).

---

## Endpoint

```
DELETE /api/account
```

---

## Authentication

**Required.** The request MUST include a valid `Authorization: Bearer <token>` header.

The bearer token must be a valid JWT issued by one of the configured OIDC providers
(Microsoft Entra ID or Google), validated using the existing `authorise()` middleware.

The deletion is scoped exclusively to the authenticated user's `sub` claim (`token.sub`).
No request body parameters can alter the scope — it is always "delete the authenticated user".

---

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | ✅ | `Bearer <id_token>` — standard JWT for this app |
| `Content-Type` | ✅ | `application/json` |

### Body

None. The deletion scope is derived entirely from the authenticated JWT.

---

## Response

### 204 No Content — Success

All server-side data for the user has been permanently deleted:
- User profile document
- AllowList document
- All Phrasebook documents
- All VocabularyEntry documents
- All AIEnrichment documents

```
HTTP/1.1 204 No Content
```

No response body.

---

### 401 Unauthorized — Missing or invalid token

```json
{
  "message": "Missing or malformed Authorization header"
}
```

Also returned if the JWT has expired or its signature cannot be verified.

---

### 403 Forbidden — Token valid but not allow-listed

Not expected during normal deletion (a previously allow-listed user's token is valid for
this one final request even after the allow-list check, since deletion is the last action).

> Note: The `authorise()` middleware performs an allow-list check. To allow an allow-listed
> user to delete their own account, the deletion handler uses `authorise()` normally —
> the user is allow-listed at the moment they initiate deletion.

---

### 500 Internal Server Error — Unexpected failure

```json
{
  "message": "Failed to delete account. Please try again."
}
```

The frontend MUST show a retryable error and MUST NOT sign the user out or clear local
data when this response is received (FR-007).

---

## Behaviour Guarantees

| Property | Guarantee |
|----------|-----------|
| Idempotency | Safe to call multiple times — individual document deletes are 404-tolerant |
| Scope | Only documents with `userId === token.sub` are affected |
| Atomicity | Best-effort — Cosmos DB does not support cross-document transactions at this scale. If an intermediate delete fails, partial deletion is possible. The endpoint re-runs safely on retry. |
| AllowList cleanup | The user's AllowList record is deleted, revoking future access |

---

## Example Client Request

```typescript
// frontend/src/services/api.ts (to be added)
export async function deleteAccount(): Promise<void> {
  await apiFetch<void>('/account', { method: 'DELETE' }, true);
}
```

---

## Security Notes

- The endpoint does not accept a `userId` parameter. The target user is always `token.sub`.
- Rate limiting is not applied (deletion is a one-time action per user lifetime).
- The endpoint must be registered via `app.http(...)` in the Azure Functions Node.js v4 style
  consistent with all other functions in this codebase.
