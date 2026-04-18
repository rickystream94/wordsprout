# Quickstart: Deploying WordSprout to Azure

**Feature**: 003-cicd-azure-infra-deploy
**Date**: 2026-04-18

> **Configuration note**: All resource names, regions, subscription and tenant IDs are stored in [`infra/config.json`](../../infra/config.json). Commands below read from that file — do not hardcode values.

---

## Overview

| Scenario | Who | How | When |
|---|---|---|---|
| **DEV deployment** | Developer | Run `scripts/deploy-dev.ps1` locally | On demand, from local machine |
| **PROD deployment** | GitHub Actions | Automatically on push to `master` | Every merge to `master` |

> **First time?** Read [docs/runbook.md](../../docs/runbook.md) first — it documents the one-time Azure and GitHub setup steps that must be completed before either deployment scenario works.

---

## Prerequisites

### For DEV deployment (local machine)

| Tool | Version | Install |
|---|---|---|
| Node.js | 20.x LTS | https://nodejs.org |
| Azure CLI | ≥ 2.60 | `winget install Microsoft.AzureCLI` |
| Azure Functions Core Tools | v4 | `npm install -g azure-functions-core-tools@4` |
| PowerShell | 7.x | https://github.com/PowerShell/PowerShell |
| Bicep CLI | ≥ 0.26 | `az bicep install` (auto-installed with Az CLI) |

Verify:
```powershell
az --version
func --version   # must be 4.x
node --version   # must be 20.x
```

Authenticate to Azure:
```powershell
$cfg = Get-Content infra/config.json | ConvertFrom-Json
az login
az account set --subscription $cfg.subscriptionId
az account show  # confirm correct subscription
```

---

## DEV Deployment

### First-time setup

1. Complete all one-time steps in [docs/runbook.md](../../docs/runbook.md) (Entra ID app registrations, OIDC setup, etc.)

2. Run the Entra app setup if not done yet — it populates `entraClientId` in `infra/config.json`:
```powershell
$cfg = Get-Content infra/config.json | ConvertFrom-Json
az login --tenant $cfg.tenantId
.\scripts\setup-entra-apps.ps1
```

### Run the deploy script

```powershell
# Full deployment (infrastructure + app code)
.\scripts\deploy-dev.ps1

# Redeploy app code only (infrastructure already exists)
.\scripts\deploy-dev.ps1 -SkipInfra

# Provision infrastructure only (no code deploy)
.\scripts\deploy-dev.ps1 -SkipApp
```

The script is **idempotent** — running it multiple times is safe. Existing data in Cosmos DB is not affected.

### What the script does

1. Validates prerequisites and Azure authentication (reads subscription from `infra/config.json`)
2. Creates the data resource group if absent (`dataResourceGroup`), deploys `infra/data.bicep` (Storage + Cosmos DB)
3. Creates the service resource group if absent (`serviceResourceGroup`), deploys `infra/main.bicep` (Function App + SWA)
4. Builds frontend: `npm run build -- --mode dev`
5. Deploys static files via `az staticwebapp deploy`
6. Builds API: `npm run build` (TypeScript → JS)
7. Publishes API to the Function App
8. Prints the DEV URL on success

### Testing the DEV deployment

1. Open the DEV URL printed by the script
2. The Entra ID sign-in page should appear
3. Sign in with a Microsoft account (personal or work/school)
4. The backend will return `403` until you add yourself to the allowlist:

```powershell
# List pending access requests (the sub claim is shown for each)
.\scripts\manage-allowlist.ps1 -Environment dev -List

# Approve yourself
.\scripts\manage-allowlist.ps1 -Environment dev -Approve -Email "your@email.com" -Sub "<sub-from-list-output>"
```

5. Sign out and sign back in — you should now reach the home page
6. Create a phrasebook, add an entry, verify it persists across page reloads

---

## PROD Deployment (GitHub Actions)

PROD deployment is **fully automated** — no manual steps required after initial setup.

### Trigger

Pushing to `master` (via a merged pull request) triggers the `cd-prod.yml` workflow automatically.

### Monitoring

1. Navigate to the GitHub repository → **Actions** tab
2. Click the `Deploy PROD` workflow run
3. Both `build` and `deploy` jobs must show ✓ green

### Rollback

To roll back PROD to a previous version:
1. Revert the merge commit on `master`
2. The CD workflow triggers automatically and deploys the previous version

Alternatively, use the GitHub Actions "Re-run workflow" on the last successful run.

---

## Running Locally Against DEV Resources (Hybrid Mode)

You can run the frontend locally (Vite dev server) while the API calls go to the deployed DEV Function App.

1. Run Vite in dev mode:
```powershell
cd frontend
npm run dev -- --mode dev
```

The Vite dev server will proxy `/api` calls to the DEV Function App, requiring real Entra ID authentication.

> **Note**: For fully local development (auth bypassed), use `.\dev.ps1` — it starts both the API emulator and Vite dev server in `local` mode.

---

## Troubleshooting

### Deploy script fails: "az login required"
```powershell
$cfg = Get-Content infra/config.json | ConvertFrom-Json
az login
az account set --subscription $cfg.subscriptionId
```

### API returns 401 for all requests
- The JWT is not being sent or is invalid
- In browser dev tools, check the `Authorization` header on API requests
- Verify `VITE_ENTRA_CLIENT_ID` in the frontend env file matches `environments.dev.entraClientId` in `infra/config.json`
- Check the browser console for MSAL errors

### Function App returns 403 after sign-in
- You are not on the allowlist yet
- Run `.\scripts\manage-allowlist.ps1 -Environment dev -List` to see pending requests
- Approve yourself with `-Approve -Email <email> -Sub <sub>`

### API returns 403 after successful login
- Your user is not on the allowlist
- Follow the "Add yourself to the allowlist" step in the DEV Testing section above

### AI enrichment fails with 401
- `AZURE_AI_KEY` Key Vault reference may not be resolved yet
- Check Function App → Configuration → `AZURE_AI_KEY` shows "Resolved"
- Verify the Azure OpenAI resource has a `gpt-4o-mini` deployment named exactly `gpt-4o-mini`
