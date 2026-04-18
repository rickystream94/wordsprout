# WordSprout Infrastructure Runbook

**Last updated**: 2026-04-18
**Configuration**: All resource names, regions, subscription and tenant IDs live in [`infra/config.json`](../infra/config.json) — that file is the single source of truth.
This runbook records every Azure resource created for WordSprout, the commands used to create them, and all manual setup steps. A developer with Azure access but no prior knowledge of this project should be able to follow this document and provision a fully working environment.

---

## Prerequisites

Install these tools before proceeding:

| Tool | Minimum version | Install |
|---|---|---|
| Azure CLI | 2.60 | https://aka.ms/installazurecliwindows |
| Azure Functions Core Tools | 4.x | `npm install -g azure-functions-core-tools@4` |
| Bicep CLI | 0.26+ | auto-installed via `az bicep install` |
| Node.js | 24.x | https://nodejs.org |
| npm | 9.x | bundled with Node |
| PowerShell | 7.x | https://aka.ms/pscore6 |
| Git | any | https://git-scm.com |

Verify:
```powershell
az --version
func --version
node --version
npm --version
pwsh --version
az bicep version   # or: az bicep install
```

---

## 1 — One-time: Entra ID App Registrations

> These steps only need to be run once per environment.
> App registrations are created in the tenant defined in `infra/config.json` (`tenantId`) with audience **AzureADandPersonalMicrosoftAccount** (any Microsoft account, personal or work/school). The allow-list controls who can actually use the app.

### 1.1 Register the DEV and PROD Apps (automated)

Log in to the tenant, then run the setup script. It creates both app registrations with the correct SPA redirect URIs and writes the client IDs to `infra/config.json`:

```powershell
$cfg = Get-Content infra/config.json | ConvertFrom-Json
az login --tenant $cfg.tenantId
.\scripts\setup-entra-apps.ps1
```

After the script completes, `infra/config.json` will have `environments.dev.entraClientId` and `environments.prod.entraClientId` populated.

> **One remaining manual step (after first PROD deploy)**: Update the PROD app registration’s redirect URI once the actual SWA hostname is known. The script registers `https://placeholder.azurestaticapps.net` as a placeholder.
> Azure Portal → Entra ID → App registrations → `wordsprout-prod` → Authentication → replace the placeholder URI.

---

## 2 — One-time: OIDC Setup (GitHub Actions → Azure)

> **Automated** — `scripts/setup-oidc.ps1` handles the app registration, federated credential, and role assignment in one step.

### 2.1 Set up OIDC (automated)

```powershell
# Replace <your-github-org> with your GitHub username or organisation
.\scripts\setup-oidc.ps1 -GitHubOrg '<your-github-org>'
```

The script:
1. Creates the `wordsprout-github-actions` Azure AD app registration
2. Adds a federated credential scoped to `repo:<org>/wordsprout:ref:refs/heads/master`
3. Assigns `Contributor` role on the PROD resource group (`environments.prod.resourceGroup` from `infra/config.json`)
4. Saves `oidcClientId`, `github.org`, and `github.repo` to `infra/config.json`
5. Prints the three GitHub Actions Variables you need to set

---

## 3 — One-time: GitHub Repository Setup

### 3.1 Configure GitHub Actions Variables

No GitHub Actions Variables or Secrets are required. All deployment constants are read from `infra/config.json` at workflow run time via `jq`. The SWA hostname is obtained directly from the infra deployment output and used to build the frontend in the same job — it is never stored anywhere.

### 3.2 Configure Branch Protection (optional)

> Skip this if you are the sole contributor. Branch protection is useful when collaborating to prevent direct pushes to `master`.

1. **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `master`
3. Enable:
   - **Require a pull request before merging**
   - **Require status checks to pass before merging** → add `validate` (from `CI` workflow)
   - **Require branches to be up to date before merging**
4. Save.

---

## 4 — One-time: Provision PROD Azure Infrastructure

> Run this once before the first `cd-prod.yml` deploy. After this, all PROD code updates happen automatically on push to `master`.
> All values below are available in `infra/config.json` after running the setup scripts.

```powershell
$cfg = Get-Content infra/config.json | ConvertFrom-Json

# Authenticate
az login
az account set --subscription $cfg.subscriptionId

# Create resource group and deploy all infrastructure (Storage, Cosmos DB, Function App, SWA, RBAC)
az group create --name $cfg.environments.prod.resourceGroup --location $cfg.region
az deployment group create `
  --resource-group $cfg.environments.prod.resourceGroup `
  --template-file infra/main.bicep `
  --parameters env=prod `
  --parameters "location=$($cfg.region)" `
  --parameters aiQuotaLimit=20 `
  --parameters "entraTenantId=$($cfg.tenantId)" `
  --parameters "entraClientId=$($cfg.environments.prod.entraClientId)"
```

---

## 5 — DEV Deployment

> For ongoing DEV deployments, use the deploy script. See also [quickstart.md](../specs/003-cicd-azure-infra-deploy/quickstart.md).
> After running `setup-entra-apps.ps1`, no parameters are required.

```powershell
# First time: authenticate
$cfg = Get-Content infra/config.json | ConvertFrom-Json
az login
az account set --subscription $cfg.subscriptionId

# Deploy (provisions infra if needed, then deploys code) — reads all values from infra/config.json
.\scripts\deploy-dev.ps1

# Code-only redeployment (skip infra)
.\scripts\deploy-dev.ps1 -SkipInfra
```

---

## 6 — Resource Inventory

Resource names are defined in `infra/config.json` under `environments.dev` and `environments.prod`.
Each environment uses a **single resource group** for all resources.

Run `(Get-Content infra/config.json | ConvertFrom-Json).environments` to see current values.

### DEV

| `config.json` field | Type | SKU/Tier | Purpose |
|---|---|---|---|
| `swaName` | Static Web App | Standard | Frontend hosting (BYOF linked backend requires Standard) |
| `funcAppName` + `plan-wordsprout-dev` | Function App | Flex Consumption FC1, Node 24 v4 | API (BYOF backend for SWA) |
| `storageAccount` | Storage Account | Standard_LRS | Required by Function App |
| `cosmosAccount` | Cosmos DB account | Serverless, NoSQL | Application data store |
| `openAiAccount` | Azure OpenAI | S0, GlobalStandard | GPT-4o-mini enrichment — **not yet deployed** (quota pending, see §8) |

### PROD

| `config.json` field | Type | SKU/Tier | Purpose |
|---|---|---|---|
| `swaName` | Static Web App | Standard | Frontend hosting (custom domain support) |
| `funcAppName` + `plan-wordsprout-prod` | Function App | Flex Consumption FC1, Node 24 v4 | API (BYOF backend for SWA) |
| `storageAccount` | Storage Account | Standard_LRS | Required by Function App |
| `cosmosAccount` | Cosmos DB account | Serverless, NoSQL | Application data store |
| `openAiAccount` | Azure OpenAI | S0, GlobalStandard | GPT-4o-mini enrichment — **not yet deployed** (quota pending, see §8) |

---

## 7 — Allowlist Management

WordSprout uses an invitation-based allowlist. New users submit an access request via the UI. An admin must approve them using the management script.

### List pending requests

```powershell
.\scripts\manage-allowlist.ps1 -Environment dev -List
.\scripts\manage-allowlist.ps1 -Environment prod -List
```

Output shows each requester's email, request timestamp, and document ID.

### Approve a user

> **You need the user's `sub` claim** (the pairwise subject identifier from their JWT, used as `userId` throughout the app).
> **Get it from the access request**: run `-List` and copy the `sub` value shown for that user.
> Do not rely on the Azure portal — personal Microsoft accounts (`@outlook.com` etc.) and accounts from other tenants are not materialised as users in this tenant, so their Object ID is not visible there.

```powershell
.\scripts\manage-allowlist.ps1 `
  -Environment prod `
  -Approve `
  -Email "user@example.com" `
  -Sub "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

The script:
1. Finds the pending access request by email
2. Creates an `allowlist:<sub>` document in Cosmos DB
3. Updates the access request status to `approved`

---

## 8 — AI Enrichment (Temporarily Disabled)

AI enrichment via Azure OpenAI is currently disabled while a GPT-4o-mini GlobalStandard quota increase is pending approval for the region defined in `infra/config.json` (`openAiLocation`). The Enrich button is greyed out in the app UI with a "Coming soon" tooltip in all non-local environments.

### Re-enabling AI enrichment

Once quota is approved:

1. **Request quota** — [https://oai.azure.com](https://oai.azure.com) → Quotas → request `gpt-4o-mini GlobalStandard` capacity in the region set as `openAiLocation` in `infra/config.json` (1K TPM is enough for dev).

2. **Re-enable the Bicep resources** — in `infra/main.bicep`, uncomment:
   - §3: the `openai` module block
   - §5: the OpenAI RBAC role assignment block (`cosmosRbac` is §5; OpenAI RBAC is §6)
   - The `openaiEndpoint` param in the `funcapp` module call (§4)
   - The `openaiEndpoint` output at the bottom

3. **Re-enable the frontend feature flag** — in `frontend/src/config/env.ts`, change:
   ```ts
   export const FEATURES_AI_ENABLED = IS_LOCAL;
   ```
   to:
   ```ts
   export const FEATURES_AI_ENABLED = true;
   ```

4. **Redeploy** — run `deploy-dev.ps1` (DEV) or push to `master` (PROD).

> **No secrets required.** The Function App authenticates to Azure OpenAI via its System-Assigned Managed Identity (`Cognitive Services OpenAI User` role). `disableLocalAuth: true` is set on the OpenAI account.

---

## 9 — Estimated Monthly Cost (DEV + PROD)

| Service | DEV | PROD |
|---|---|---|
| Static Web App | ~$9 (Standard) | ~$9 (Standard) |
| Function App (Flex Consumption FC1) | ~$0–1 (pay-per-execution) | ~$1–3 (pay-per-execution) |
| Cosmos DB (Serverless) | ~$0–1 | ~$1–3 |
| Azure OpenAI (pay-per-token) | ~$0–1 *(not yet deployed)* | ~$1–3 *(not yet deployed)* |
| Storage | ~$0 | ~$0 |
| **Total** | **~$0–3** | **~$12–18** |

Combined target: under $20/month.
