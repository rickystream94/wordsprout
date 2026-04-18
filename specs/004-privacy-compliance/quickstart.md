# Quickstart: Privacy & Compliance (004)

**Branch**: `004-privacy-compliance` | **Date**: 2026-04-18

---

## What This Feature Adds

| Area | Change |
|------|--------|
| API | New `DELETE /api/account` Azure Function |
| API | `CosmosClientWrapper.deleteAllForPartition()` method (+ mock) |
| Frontend | `/privacy` page — Privacy Policy (public, offline-capable) |
| Frontend | `/terms` page — Terms & Conditions (public, offline-capable) |
| Frontend | Footer links in `AppShell` and `Login` page |
| Frontend | "Delete Account" in `UserMenu` with confirmation dialog |
| Frontend | `deleteAccount()` function in `services/api.ts` |
| Frontend | `clearLocalData()` function in `services/db.ts` |

---

## Local Development Setup

No new environment variables are required. All changes work with the existing
`local`, `dev`, and `prod` environment configurations.

```bash
# From repo root — start everything locally
.\dev.ps1
```

---

## Testing Account Deletion Locally

1. Start the local dev environment with `.\dev.ps1`
2. Sign in — you'll see data from `.cosmos-mock.json` if any exists
3. Open the UserMenu (avatar button top-right)
4. Click "Delete Account"
5. Read the confirmation dialog and click "Delete Account" to confirm
6. You'll be signed out and redirected to `/login`
7. Verify: `.cosmos-mock.json` no longer contains your user's documents
8. Sign in again — you'll see an empty state (no phrasebooks)

---

## Testing Privacy & T&C Pages

Both pages are accessible without authentication:

```
http://localhost:5173/privacy
http://localhost:5173/terms
```

To verify offline availability:
1. Load either page while online
2. Open browser DevTools → Network → switch to "Offline"
3. Reload — the page should still render from cache/bundle

---

## Key File Locations

```
api/src/functions/account.ts          ← NEW: DELETE /api/account handler
api/src/services/cosmos.ts            ← MODIFIED: add deleteAllForPartition()
api/src/services/cosmos.mock.ts       ← MODIFIED: add deleteAllForPartition()

frontend/src/pages/PrivacyPolicy.tsx  ← NEW: Privacy Policy page
frontend/src/pages/Terms.tsx          ← NEW: Terms & Conditions page
frontend/src/pages/PrivacyPolicy.module.css  ← NEW: styles
frontend/src/pages/Terms.module.css   ← NEW: styles (can share with PrivacyPolicy)
frontend/src/components/layout/AppShell.tsx  ← MODIFIED: add footer
frontend/src/components/layout/AppShell.module.css  ← MODIFIED: footer styles
frontend/src/components/layout/UserMenu.tsx  ← MODIFIED: add Delete Account button + dialog
frontend/src/components/layout/UserMenu.module.css  ← MODIFIED: danger button styles
frontend/src/pages/Login.tsx          ← MODIFIED: add T&C and Privacy links in footer
frontend/src/services/api.ts          ← MODIFIED: add deleteAccount()
frontend/src/services/db.ts           ← MODIFIED: add clearLocalData()
frontend/src/main.tsx                 ← MODIFIED: add /privacy and /terms routes
```

---

## Verification Checklist

- [ ] `DELETE /api/account` returns 204 and removes all cosmos mock data for the user
- [ ] Calling `DELETE /api/account` twice returns 204 both times (idempotent)
- [ ] Calling `DELETE /api/account` without auth returns 401
- [ ] After deletion, signing in again shows empty state (no phrasebooks)
- [ ] `/privacy` loads without signing in (open in incognito)
- [ ] `/terms` loads without signing in (open in incognito)
- [ ] Footer links appear on all authenticated pages
- [ ] T&C and Privacy links appear on the Login page
- [ ] Delete Account button in UserMenu opens confirmation dialog
- [ ] Dismissing the dialog leaves all data intact
- [ ] No TypeScript errors: `npx tsc --noEmit` from `frontend/` and `api/`
