# Quickstart: Data Export & Import

**Phase 1 output** | **Branch**: `006-data-export-import`

This guide covers how to manually test the export and import features once implemented, and how to verify security validation gates.

---

## Prerequisites

- Local dev environment running: `./dev.ps1` (starts API + frontend)
- Signed in as an allow-listed user with at least one phrasebook and a few entries
- Browser DevTools open to the Console and Network tabs

---

## 1. Export

### 1a. Navigate to Settings

1. Sign in to WordSprout.
2. Navigate to `/settings` (or use the Settings link in navigation).
3. Find the **Account Data** section.

### 1b. Trigger an Export

1. Click **Export my data**.
2. If online, the app will briefly show "Syncing latest data…" while pulling from the server.
3. A file named `wordsprout-backup-YYYY-MM-DD.json` is downloaded to your device.
4. Open the file in a text editor or JSON viewer.

### 1c. Verify the Export File

Check the following in the downloaded file:

```json
{
  "schemaVersion": 1,
  "app": "wordsprout",
  "exportedAt": "...",
  "data": {
    "phrasebooks": [...],
    "entries": [...],
    "enrichments": [...]
  }
}
```

- `schemaVersion` must be `1`
- `app` must be `"wordsprout"`
- No `userId` fields should appear anywhere in the file
- No `type` fields should appear anywhere in the file
- Entry count in `data.entries` should match the total entries shown in the app

### 1d. Test Offline Export

1. Open DevTools → Network → set throttling to **Offline**.
2. Click **Export my data** again.
3. The export should still complete (from IndexedDB) with the note "Exported from local data (offline)".

---

## 2. Import

### 2a. Basic Import (Happy Path)

1. Use the export file from step 1 above.
2. Navigate to `/settings` → **Account Data** → **Import data**.
3. Click **Choose file** and select the `wordsprout-backup-YYYY-MM-DD.json` file.
4. The app shows a confirmation dialog: "This will replace all your current data with N phrasebooks and M entries. This cannot be undone."
5. Click **Confirm import**.
6. After completion, a success message appears: "Imported N phrasebooks and M entries."
7. Navigate to Home — all your phrasebooks should be present.

### 2b. Verify Data Fidelity

After a successful import:
- Open each phrasebook and verify entries, tags, and notes are intact.
- Check the Review page — learning scores and last-reviewed dates should be preserved.
- If enrichments existed, open an entry and verify enrichment content is present.

### 2c. Test Re-import Idempotency

1. Import the same backup file a second time (wait > 5 minutes for the rate limit to clear).
2. The result should be identical to the first import.
3. The app should show the same phrasebook and entry counts.

---

## 3. Security Validation Gates

### 3a. Non-JSON File Rejection

1. Rename any file to `test.exe.json` (so it has the right extension but wrong content, or just use a plain text file).
2. Actually, use a file containing `not json at all` as its content.
3. Select it in the Import file picker.
4. **Expected**: File is rejected immediately with "File is not valid JSON" — no confirmation dialog appears, no network request is made.

### 3b. Wrong Schema Structure

1. Create a file `wrong.json` with content: `{"schemaVersion": 1, "app": "wordsprout", "data": {}}`  (missing `exportedAt` and data is missing required arrays).
2. Select it in the Import file picker.
3. **Expected**: "Backup file has an unexpected structure" error — no network request.

### 3c. Unknown Schema Version

1. Take a valid export file and change `"schemaVersion": 1` to `"schemaVersion": 99`.
2. Select it in the Import file picker.
3. **Expected**: "This backup was created with a newer version of WordSprout. Please update the app and try again." — no network request.

### 3d. Wrong App Identifier

1. Take a valid export file and change `"app": "wordsprout"` to `"app": "otheranimalapp"`.
2. Select it in the Import file picker.
3. **Expected**: "File does not appear to be a WordSprout backup" — no network request.

### 3e. Oversized File Rejection (client-side)

1. Create a JSON file that is > 10 MB (e.g., pad the `entries` array with many large strings).
2. Select it in the Import file picker.
3. **Expected**: "File is too large (maximum 10 MB)" error immediately — no network request.

### 3f. Embedded Script Content (sanitisation check)

1. Create a valid export file. In one entry's `notes` field, set the value to: `<script>alert('xss')</script>`.
2. Import the file.
3. After import, open that entry.
4. **Expected**: The `notes` field is empty or shows the sanitised text (the `<script>` tag is stripped). No alert fires.

### 3g. Rate Limit

1. Import a valid file.
2. Immediately try to import again.
3. **Expected**: 429 response — "Import rate limit exceeded. Please wait 5 minutes before importing again."

### 3h. Missing Mandatory Fields

1. Create an import file where one entry is missing `sourceText`:
   ```json
   { "id": "...", "phrasebookId": "...", "tags": [], "learningScore": 0, "lastReviewedDate": null, "createdAt": "...", "updatedAt": "..." }
   ```
2. Import the file.
3. **Expected**: Server returns 422 — "One or more entries are missing required fields (sourceText, phrasebookId)". No data is changed.

### 3i. Orphaned Entry (invalid phrasebookId reference)

1. Create an import file where one entry's `phrasebookId` does not match any phrasebook in `data.phrasebooks`.
2. Import the file.
3. **Expected**: Server returns 422 — "One or more entries reference a phrasebook that is not in this backup". No data is changed.

---

## 4. Cross-Device / Cross-Browser Test

1. Export data on a desktop browser (e.g., Chrome on Windows).
2. Transfer the backup file to a mobile device (e.g., via email or AirDrop).
3. Sign in to WordSprout on the mobile device (e.g., Safari on iOS).
4. Navigate to `/settings` → **Import data** → select the transferred file.
5. **Expected**: Import completes successfully with all data intact.

---

## 5. New Files After Implementation

```
api/src/functions/dataPortability.ts     ← POST /data/import handler
frontend/src/services/export.ts          ← Export + client validation utilities
frontend/src/pages/Settings.tsx          ← Settings page UI
frontend/src/pages/Settings.module.css   ← Settings page styles
```

## 6. Modified Files After Implementation

```
api/src/models/types.ts                  ← ExportPackage types; lastImportAt? on User
frontend/src/services/db.ts              ← clearUserContent(), bulkRestoreFromExport()
frontend/src/main.tsx                    ← /settings route
```
