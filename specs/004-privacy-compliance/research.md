# Research: Privacy & Compliance

**Branch**: `004-privacy-compliance` | **Date**: 2026-04-18
**Phase**: 0 — Resolves all NEEDS CLARIFICATION from Technical Context

---

## 1. Cosmos DB — Bulk Delete for a User Partition

### Question
How do we efficiently delete all documents belonging to a user from Cosmos DB (Serverless,
Core/NoSQL API) given that the existing `CosmosClientWrapper` only exposes single-item delete?

### Decision
**Extend `CosmosClientWrapper` with a `deleteAllForPartition(partitionKey)` method**.

Cosmos DB Core/NoSQL does not support a single "delete all documents in a partition key"
operation via the SDK (batch transactional API is limited to 100 items and same partition key).
The correct approach for a personal-scale app is:

1. Query all document `id`s for the userId partition (across all document types).
2. Issue individual `deleteItem` calls for each `id`.

Since WordSprout users typically have tens to hundreds of entries (not millions), this
fan-out approach is appropriate. There is no need for a background job or paginated batch.

**Query strategy**: Execute a single `SELECT c.id, c.type FROM c WHERE c.userId = @userId`
query scoped to the userId partition key. This returns lightweight stubs. Then delete each
document by id + partitionKey.

**Alternatives considered**:
- Cosmos DB Bulk Executor — overkill for this scale and requires additional dependency.
- Azure Cosmos DB TTL (time-to-live) — not suitable for immediate on-demand deletion.
- Separate query per document type — more round trips; single cross-type query is simpler.

### Rationale
Consistent with the existing `queryByPartition` pattern, avoids new dependencies, and is
correct for personal-scale data volumes (≤1000 documents per user typical).

---

## 2. Local Data Deletion — Dexie + IndexedDB

### Question
How do we reliably clear all local user data from the browser (Dexie IndexedDB database +
any auth session storage) when an account is deleted?

### Decision
**Delete the entire Dexie database using `Dexie.delete('wordsprout')`** after a successful
server-side deletion response.

This drops the IndexedDB database entirely, which:
- Clears all tables: phrasebooks, entries, enrichments, pendingSync, meta.
- Is simpler and more complete than truncating tables individually.
- Correctly handles any future table additions without needing code updates.

In addition, the existing `logout()` call (from `AuthProvider`) clears MSAL/Google session
tokens from localStorage/sessionStorage. We call `logout()` after the DB deletion.

**Ordering**: Server deletion → local DB deletion → logout → redirect to /login.

If server deletion fails, we do NOT proceed with local deletion or logout (FR-007).

**Alternatives considered**:
- `db.phrasebooks.clear()` etc. per table — less complete, misses future tables.
- `indexedDB.deleteDatabase('wordsprout')` directly — equivalent to `Dexie.delete()`
  but lower-level; Dexie.delete is the idiomatic approach.

---

## 3. Privacy / T&C Pages — Offline Strategy

### Question
How should the Privacy Policy and T&C pages be made available offline (FR-014, FR-019)
given the offline-first constraint (Constitution III)?

### Decision
**Embed content directly as React components with static JSX/TSX text**.

Since these are purely informational pages with static content, embedding the text directly
in TSX files means the content is bundled with the JavaScript application bundle. The PWA
service worker caches the application shell and assets on first load, making them available
offline automatically with no additional work.

This is the simplest, most reliable approach: no network request is ever needed because
the content lives in the bundle.

**Alternatives considered**:
- Markdown files loaded at runtime — requires a fetch request, which could fail offline.
- Static HTML files served separately — adds complexity to SWA routing and cache management.
- Database-stored content — completely inappropriate for static legal text.

---

## 4. UI Placement — "Delete Account" Action

### Question
Where in the UI should the "Delete Account" action live? Should there be a dedicated
Settings page, or can it live in the existing UserMenu?

### Decision
**Add a "Delete Account" button to the existing `UserMenu` dropdown** (no new Settings page).

The UserMenu already contains account-related actions (sign out). Adding "Delete Account"
there follows established UI conventions (account actions together) and avoids scope creep
for this feature.

The button will be styled distinctively (danger/destructive colour) and separated by a
visual divider from the Sign Out button to reduce the risk of accidental tap.

A confirmation modal/dialog component will be added inline (rendered from within UserMenu
state) to satisfy FR-002 and FR-003.

**Alternatives considered**:
- Dedicated `/settings` page — adds more complexity and navigation for a single action.
  Can be added in a future settings feature; this feature deliberately limits scope.
- Modal triggered from a standalone Settings link — valid but unnecessary for one action.

---

## 5. Static Pages — Route & Auth Strategy

### Question
Should `/privacy` and `/terms` be truly public (no auth check) or just accessible
without auth? How do they integrate with the existing routing hierarchy?

### Decision
**Add `/privacy` and `/terms` as public top-level routes in the React Router config**,
outside of both `AuthenticatedRoute` and `AuthGuard` wrappers.

These routes render standalone page components (no AppShell, no header nav required —
but should include a minimal header and a back/home link for usability).

The `staticwebapp.config.json` `navigationFallback` already rewrites all SPA paths to
`/index.html`, so no additional Azure SWA routing configuration is needed.

**Access without auth**: The routes are placed above all auth guards in the route tree,
ensuring no auth check runs for them. This satisfies FR-011 and FR-016.

---

## 6. Footer Links

### Question
There is currently no footer element in `AppShell`. How should footer links to Privacy
and T&C be added?

### Decision
**Add a minimal `<footer>` element to `AppShell.tsx`** with links to `/privacy` and
`/terms`. The footer should also be present (as a standalone minimal element) on the
public pages (Privacy, T&C, Login) for discoverability.

Since the spec only requires footer links on "all pages" (FR-012, FR-017) and the Login
screen specifically (FR-017), we will:
- Add a footer to AppShell (covering all authenticated pages).
- Add footer links to the Login page.
- The Privacy and T&C pages themselves will include a minimal "back to app" link.

---

## 7. API Authentication for Deletion Endpoint

### Question
The deletion endpoint must only accept requests from the authenticated account being
deleted (FR-009). How is this enforced?

### Decision
**Reuse the existing `authorise()` middleware** (already used by all other API functions).
The `authorise()` function validates the JWT and returns the `DecodedToken` with `token.sub`
as the `userId`. The deletion function will only delete documents where `userId === token.sub`.

This is a natural extension of the existing authorisation pattern — no new auth mechanism
is needed. Attempting to delete another user's data is structurally impossible because all
queries and deletes are scoped to `token.sub`.

---

## 8. Deletion of AllowList Record

### Question
The `AllowList` document uses `userId` as both `id` and `userId` (partition key) for
point-read efficiency. Is this the correct document to delete on account deletion?

### Decision
**Yes — delete the AllowList document with `id = token.sub` and `partitionKey = token.sub`**.

Looking at the existing codebase, the AllowList document structure has `id = userId`
(since it's looked up by a point-read using `userId` as both id and partition key in the
`authorise()` middleware). This makes deletion straightforward: one extra `deleteItem`
call with the user's id as both parameters.

By deleting the AllowList record, the user's email is removed from the access allowlist.
If they sign in again, they will be treated as a new (non-allow-listed) user and will
need to re-request access — this is the correct GDPR erasure behaviour.

---

## Summary of All Decisions

| Decision | Chosen Approach |
|----------|----------------|
| Cosmos bulk delete | Extend CosmosClientWrapper with `deleteAllForPartition()` |
| Local data deletion | `Dexie.delete('wordsprout')` then `logout()` |
| Privacy/T&C offline | Embed text as TSX components in JS bundle |
| Delete Account UI | Add to UserMenu dropdown with confirmation modal |
| Page routing | Public top-level routes, outside all auth guards |
| Footer | Add `<footer>` to AppShell + Login page |
| API auth for deletion | Existing `authorise()` middleware, scoped to `token.sub` |
| AllowList deletion | `deleteItem(token.sub, token.sub)` |
