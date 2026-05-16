# Research: Data Export & Import

**Phase 0 — All unknowns resolved**
**Branch**: `006-data-export-import`

---

## R-001: Export Architecture — Client-Side vs Server-Side

**Question**: Should export be implemented as a client-side operation (reading IndexedDB) or a server-side operation (querying Cosmos DB and streaming a response)?

**Decision**: Client-side export. Reads from IndexedDB. Triggers a best-effort sync pull first if the device is online; does not block on it.

**Rationale**:
Client-side export aligns with the offline-first architecture and has zero API cost. Since IndexedDB is the primary data store and is kept current via background sync, it is the canonical local source of truth. The user's data is already present on the device; generating the export file in the browser requires no round-trip.

The only risk — that IndexedDB lags behind Cosmos — is mitigated by triggering `pullFromServer()` before building the export package when the device is online. If offline, the export proceeds from the current local state (acceptable trade-off: the user is explicitly backing up what they have on this device).

A server-side export endpoint was considered and rejected: adds API cost ($0 vs ~$0.01 per export in Cosmos RUs), requires network connectivity, adds implementation complexity, and provides no data-quality advantage over a post-sync client-side export.

**Alternatives Considered**:
- `GET /data/export` server endpoint — Rejected: unnecessary cost and network dependency; no correctness advantage.
- Server export only for "canonical" state — Rejected: forces online requirement for a backup operation; offline-first principle.

---

## R-002: Import Architecture — Client-Side Queue vs Server-Side Endpoint

**Question**: Should import be implemented by queuing individual mutations through the existing sync mechanism, or via a dedicated server-side endpoint that performs an atomic overwrite?

**Decision**: Dedicated server-side `POST /data/import` endpoint. The endpoint validates, sanitises, atomically deletes existing content, and bulk-writes the imported data. The client clears IndexedDB and re-populates from the response.

**Rationale**:
Import is a "replace all" operation. The sync queue is designed for incremental mutations (individual creates/updates/deletes), not for transactional replacement of an entire dataset. Key reasons the queue approach was rejected:

1. **Non-atomicity**: A queue of 10,000 mutations processed one-by-one can be interrupted at any point (device goes offline, app closes). The user would be left with a mix of old and new data with no clean recovery path.
2. **Duplicate detection false positives**: The existing `POST /phrasebooks` handler enforces per-language-pair uniqueness. Re-importing a backup of the user's own data would collide on the second import of any language pair.
3. **No "delete all first" primitive**: The sync queue has no way to express "delete everything then insert", which is required for a full restore.
4. **Queue pollution**: Thousands of queued mutations degrade sync performance for concurrent mutations (e.g., the user adds a new entry while the import is queuing).

The server-side endpoint approach gives us: atomicity (all-or-nothing), correct ordering (deletes complete before inserts begin), a single network round-trip, and a clean response payload to re-hydrate IndexedDB.

**Offline import**: Import requires network connectivity. This is a justified exception to Principle III (see Complexity Tracking in plan.md). Import is not a core feature; it is a recovery/migration action for which the user can reasonably be expected to have connectivity.

**Alternatives Considered**:
- Replay through sync queue — Rejected for reasons above.
- Client-side only (write to IndexedDB, mark all as pending-sync, let sync propagate) — Rejected: no server-side sanitisation; data could enter Cosmos unsanitised if the client is compromised; still has atomicity problem.

---

## R-003: What to Include in the Export Package

**Question**: Which document types should be included in the export file? Specifically: should `AIEnrichment` documents be included?

**Decision**: Include phrasebooks, entries, and enrichments. Exclude: `User`, `AllowList`, `AccessRequest`, `RateLimitEntry` documents.

**Rationale**:
Enrichments contain user-authored edits (example sentences, notes, false-friend warnings edited by the user) that are first-class user data under Principle II. Losing them on restore would degrade the experience — the user would need to re-trigger AI enrichment for every entry. Including them completes the backup.

System-management documents (`User`, `AllowList`, `AccessRequest`, `RateLimitEntry`) must never be replaced by user-provided file content. They control authentication, access policy, and rate limiting. Accepting them in an import file would be a serious security vulnerability.

**Alternatives Considered**:
- Exclude enrichments — Rejected: user-authored enrichment edits are user data under Principle II; excluding them would silently lose data the user cares about.
- Include all document types — Rejected: importing a User or AllowList document from a file would allow a user to escalate their own privileges or override rate limits.

---

## R-004: Security — File Validation Strategy

**Question**: What validation layers are needed to prevent malicious or malformed files from causing harm?

**Decision**: Two-layer validation: client-side (fail fast) + server-side (authoritative).

**Client-side checks** (before the upload is sent):
1. File MIME type: must be `application/json` or `text/plain`, or filename must end in `.json`. Non-JSON files are rejected immediately.
2. File size: must be ≤ 10 MB. Oversized files are rejected before any upload.
3. JSON parse: `JSON.parse()` must succeed.
4. Schema structure: top-level shape check — must have `schemaVersion`, `app`, `exportedAt`, `data` keys.
5. Summary extraction: count phrasebooks and entries for the confirmation dialog.

**Server-side checks** (authoritative — cannot be bypassed by a modified client):
1. Content-length header check: request body > 10 MB → 413 before parsing.
2. JSON parse and full schema validation.
3. `schemaVersion` check: must equal `1`; unknown versions → 422.
4. Per-entity mandatory field validation: phrasebook must have `name`, `sourceLanguageCode`, `targetLanguageCode`; entry must have `phrasebookId`, `sourceText`.
5. Referential integrity: every `entry.phrasebookId` must reference a phrasebook present in the same import package.
6. DOMPurify sanitisation of all string fields before storage.
7. Rate limit check: last import must be > 5 minutes ago.

**Why JSON.parse() is safe**: `JSON.parse()` cannot execute code — it is not `eval()` and does not invoke the Function constructor. Embedded script strings in JSON values are data, not code. They become dangerous only if injected into the DOM unsanitised, which DOMPurify prevents.

**Alternatives Considered**:
- Zod schema validation — Considered; rejected as the project has no existing Zod dependency and manual validation matches the pattern used throughout the codebase (see `phrasebooks.ts`, `entries.ts`). Adding Zod solely for this feature would be premature abstraction.
- Server-side only validation — Rejected: provides no user-facing feedback until after upload; bad UX for oversized or clearly non-JSON files.

---

## R-005: Maximum Import File Size

**Question**: What is the appropriate maximum file size for an import file?

**Decision**: 10 MB.

**Rationale**:
Estimation based on the target scale (500 phrasebooks, 10,000 entries, 10,000 enrichments):
- Phrasebook document: ~300 bytes × 500 = ~150 KB
- Entry document: ~400 bytes × 10,000 = ~4 MB
- Enrichment document: ~800 bytes × 10,000 = ~8 MB
- Total worst case (all enrichments present): ~12 MB

A 10 MB limit comfortably covers typical usage (most users will not have enrichments for every entry) and provides a generous headroom above the 4–5 MB typical scenario. It is well within browser memory limits for `JSON.parse()` and Azure Functions request body limits (default 100 MB in Azure Functions v4). The 10 MB limit can be revisited in a future iteration if real-world data patterns demand it.

**Alternatives Considered**:
- 5 MB — Too tight: users with many enrichments could hit the limit.
- 25 MB — Unnecessarily permissive; increases worst-case server memory pressure.

---

## R-006: Schema Version Strategy

**Question**: How should schema versioning be implemented and enforced?

**Decision**: Integer `schemaVersion` field at the root of the ExportPackage. Initial version: `1`. On import, the server rejects files with `schemaVersion !== 1` (or any unknown version) with HTTP 422 and a clear user-facing message.

**Rationale**:
An integer discriminant is the simplest unambiguous version marker. When a future schema change is needed, the version is bumped and a migration function is added to the import handler (e.g., `migrateV1toV2()`). The client-side validation also checks `schemaVersion` and surfaces a friendly "This backup was created with a newer version of WordSprout" message if the version is unrecognised.

**Alternatives Considered**:
- Semantic version string (e.g., `"1.0.0"`) — More expressive but adds parsing complexity. Integer is sufficient for this use case.
- No version — Rejected: makes future schema evolution impossible without breaking all existing backups.

---

## R-007: ID Preservation During Import

**Question**: Should the IDs from the export file be preserved on import, or should new IDs be generated?

**Decision**: Preserve IDs from the export file.

**Rationale**:
Preserving IDs maintains referential integrity between entries and their enrichments (`enrichment.entryId` references `entry.id`) and between entries and phrasebooks (`entry.phrasebookId` references `phrasebook.id`) without requiring an ID translation layer. Since IDs are UUIDs generated by the client, there is no collision risk between different users' data (Cosmos partitions by `userId`). Preserving IDs also makes re-import idempotent: importing the same backup twice results in the same data state.

The `resolveId()` utility in the existing API already handles client-provided UUIDs safely.

**Alternatives Considered**:
- Generate new IDs server-side — Rejected: requires building an ID translation map for entries→phrasebooks and enrichments→entries, adding complexity for no benefit.

---

## R-008: Import Rate Limiting

**Question**: How should import be rate-limited to prevent abuse?

**Decision**: Track `lastImportAt` as a new optional field on the `User` document. The import handler reads this field and rejects requests where `lastImportAt` is within the past 5 minutes (HTTP 429).

**Rationale**:
Each full import involves deleting and re-inserting up to 20,000 documents in Cosmos (phrasebooks + entries + enrichments), representing ~$0.06 in RU cost. Without rate limiting, a malicious or buggy client could trigger hundreds of imports per hour, resulting in significant unexpected cost.

The `User` document is already the appropriate place for per-user quota tracking (see `aiQuotaUsedToday`, `aiQuotaResetAt`). A single timestamp field is the lightest possible implementation. The 5-minute window is conservative enough to prevent abuse and liberal enough to not inconvenience legitimate users (who would rarely need to import more than once in a day).

**Alternatives Considered**:
- Separate rate-limit document — Unnecessary complexity; the User document is the right place.
- No rate limiting — Rejected: potential for significant unexpected Cosmos cost.
- 1-per-day limit — Too restrictive; prevents re-import after an error without waiting 24 hours.

---

## R-009: UI Placement

**Question**: Where in the existing frontend navigation should the export and import controls be placed?

**Decision**: New `/settings` route under the AppShell (authenticated + allow-listed users). The Settings page contains an "Account Data" section with separate Export and Import panels.

**Rationale**:
Export and import are account-level data management operations, not part of the core vocabulary workflow (Home, PhrasebookView, Search, Review). Placing them on a dedicated Settings page avoids cluttering the primary navigation and matches user mental models (data management = settings). The existing AppShell already wraps all authenticated routes; adding `/settings` is a minimal change (one new route in `main.tsx`, one new page component).

The Settings page can also host the existing account deletion capability (currently no dedicated UI) for a complete account management section, though account deletion UI is out of scope for this feature.

**Alternatives Considered**:
- Inline on the Home page — Rejected: account-level actions feel out of place on the content page; harder to discover for non-obvious placement.
- Menu item in a user profile dropdown — Could be an enhancement later; for now, a direct `/settings` route is simpler and more accessible.

---

## R-010: Client-Side IndexedDB Restore Strategy

**Question**: How should the client update IndexedDB after a successful import?

**Decision**: After the server responds with 200 and the full imported dataset:
1. Clear the `pendingSync` queue (cancels any in-flight sync mutations that would conflict with the restored data).
2. Clear all content tables in IndexedDB: `phrasebooks`, `entries`, `enrichments`.
3. Bulk-write phrasebooks, entries, and enrichments from the server response.
4. Invalidate the MiniSearch index (trigger `rebuildIndex()`).

The server response includes the complete inserted dataset (with server-assigned timestamps and `userId`), not just a count — this avoids a separate pull round-trip.

**Rationale**:
Rebuilding from the server response is the safest approach: the data written to IndexedDB exactly mirrors what was written to Cosmos, with no risk of a stale-sync mismatch. Clearing `pendingSync` prevents old mutations from overwriting the freshly restored data.

**Alternatives Considered**:
- Return only a count summary, then trigger `pullFromServer()` — Rejected: adds a second round-trip; `pullFromServer()` is paginated and would take multiple requests for large datasets.
- Clear and re-build from the import file directly (without server response) — Rejected: the server may have sanitised field values during import; the client must use the canonical server-returned data.
