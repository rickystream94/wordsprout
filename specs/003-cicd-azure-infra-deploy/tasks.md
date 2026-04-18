# Tasks: CI/CD Pipeline & Azure Infrastructure Deployment

> **Historical planning document.** Task descriptions reference B2C parameters, old script flags, and resource names that have since changed. For current operational state, see [`docs/runbook.md`](../../docs/runbook.md).

**Input**: Design documents from `specs/003-cicd-azure-infra-deploy/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/deployment-contracts.md ✅ quickstart.md ✅
**Tests**: No test tasks — not requested in specification. Existing Vitest suites are unchanged.

---

## Phase 1: Setup

**Purpose**: Repository-level configuration changes that all subsequent work depends on.

- [x] T001 Update .gitignore to un-ignore env example files — add `!.env.*.example` after the `.env.*` exclusion line in .gitignore
- [x] T002 [P] Create frontend/.env.dev.example with all VITE_* vars for DEV (VITE_APP_ENV=dev, VITE_B2C_TENANT, VITE_B2C_POLICY=B2C_1_susi, VITE_B2C_CLIENT_ID, VITE_REDIRECT_URI) per contracts/deployment-contracts.md §5
- [x] T003 [P] Create frontend/.env.prod.example with all VITE_* vars for PROD (VITE_APP_ENV=prod and same keys with prod values) per contracts/deployment-contracts.md §5
- [x] T004 Update staticwebapp.config.json CSP `connect-src` directive to add `https://*.b2clogin.com` alongside existing `https://login.microsoftonline.com` per contracts/deployment-contracts.md §6

**Checkpoint**: Repository config ready — Bicep authoring and script work can begin.

---

## Phase 2: Foundational — Bicep Infrastructure Templates

**Purpose**: All Bicep modules that the deploy script and CD pipeline depend on. Must be complete before US1 or US2 implementation.

**⚠️ CRITICAL**: T011 (main.bicep) must be last — it wires all modules and depends on all prior module files existing.

- [x] T005 [P] Create infra/modules/storage.bicep — provisions `Microsoft.Storage/storageAccounts` (StorageV2, Standard_LRS); output: `storageConnectionString`, `storageAccountName`; tagged `Environment` + `Project`
- [x] T006 [P] Create infra/modules/cosmos.bicep — provisions `Microsoft.DocumentDB/databaseAccounts` (Serverless, NoSQL), nested `sqlDatabases/wordsprout` and `sqlContainers/data` with `/userId` partition key; outputs: `cosmosEndpoint`, `cosmosKey`; tagged `Environment` + `Project`
- [x] T007 [P] Create infra/modules/openai.bicep — provisions `Microsoft.CognitiveServices/accounts` (kind=OpenAI, S0), nested `deployments/gpt-4o-mini` (GlobalStandard, model version 2024-07-18, capacity param); outputs: `openaiEndpoint`, `openaiKey`; tagged `Environment` + `Project`
- [x] T008 [P] Create infra/modules/keyvault.bicep — provisions `Microsoft.KeyVault/vaults` (Standard, `enableRbacAuthorization: true`, soft-delete enabled; purge-protection param controlled by env); provisions `secrets/cosmos-key` and `secrets/openai-key`; assigns `Key Vault Secrets User` built-in role to `funcAppPrincipalId` input; outputs: `cosmosKeySecretUri`, `openaiKeySecretUri`
- [x] T009 [P] Create infra/modules/funcapp.bicep — provisions `Microsoft.Web/serverfarms` (Flex Consumption) and `Microsoft.Web/sites` (functionapp, Linux, Node 20, Functions v4); enables system-assigned MI; sets all app settings including `@Microsoft.KeyVault(SecretUri=...)` references for `COSMOS_KEY` and `AZURE_AI_KEY`, all B2C and AI config vars, and `APP_ENV`; outputs: `funcAppId`, `funcAppPrincipalId`, `funcAppName`; depends on storage + KV secret URI inputs
- [x] T010 [P] Create infra/modules/swa.bicep — provisions `Microsoft.Web/staticSites` (tier param: Free for dev, Standard for prod); provisions `Microsoft.Web/staticSites/linkedBackends` to link BYOF Function App using `funcAppId` input; outputs: `swaName`, `swaDefaultHostname`
- [x] T011 Create infra/main.bicep — root orchestration template; declares params: `env` (dev|prod), `location` (default: `denmarkeast`), `b2cTenant`, `b2cPolicy` (default: B2C_1_susi), `b2cClientId`, `aiQuotaLimit` (default: 20), `aiModelCapacity` (default: 10); calls all 6 modules in dependency order (storage → cosmos+openai → keyvault → funcapp → swa); passes outputs between modules correctly; applies resource tags at subscription scope via `az tag`

**Checkpoint**: All Bicep templates authored — DEV and PROD deployment work can begin in parallel.

---

## Phase 3: User Story 1 — Developer Deploys to DEV from Local Machine (P1) 🎯 MVP

**Goal**: A developer can run a single PowerShell script to provision all DEV Azure resources idempotently and deploy the latest frontend + API code.

**Independent Test**: Run `.\scripts\deploy-dev.ps1 -B2cTenant "<tenant>" -B2cClientId "<clientId>"` on a machine with az CLI authenticated to subscription `86264ae5-dd19-43d5-a842-4163c5c245c4` → script exits 0, DEV URL printed, app loads in browser, B2C login page appears.

- [x] T012 [US1] Create infra/parameters/dev.bicepparam — Bicep parameter file for DEV: `env='dev'`, `location='denmarkeast'`, `aiQuotaLimit=10`, `aiModelCapacity=1`; `b2cTenant`, `b2cClientId`, `b2cPolicy` left as required params (passed by deploy script at runtime) per data-model.md §Bicep Module Hierarchy
- [x] T013 [US1] Create scripts/deploy-dev.ps1 — PowerShell 7 script with params `-B2cTenant` (required), `-B2cClientId` (required), `-Location` (default: denmarkeast), `-SkipInfra` switch, `-SkipApp` switch; steps: (1) validate prerequisites (az, func, node, npm versions); (2) check `az account show` targets subscription `86264ae5-dd19-43d5-a842-4163c5c245c4`, exit with clear error if not; (3) `az group create` rg-wordsprout-dev idempotently; (4) `az deployment group create` with infra/main.bicep + infra/parameters/dev.bicepparam + runtime b2cTenant/b2cClientId params; (5) build frontend with `npm ci && npm run build -- --mode dev` in frontend/; (6) deploy frontend via `az staticwebapp deploy`; (7) build API with `npm ci && npm run build` in api/; (8) publish API via `func azure functionapp publish func-wordsprout-dev --node`; (9) print DEV URL on success. All steps guarded by `$ErrorActionPreference = 'Stop'`; -SkipInfra skips steps 3-4; -SkipApp skips steps 5-8 per data-model.md §Deployment Script Structure

**Checkpoint**: US1 fully functional — DEV environment can be provisioned and deployed locally. US2 can be started in parallel.

---

## Phase 4: User Story 2 — Automated PROD Deployment via GitHub Actions (P1)

**Goal**: Merging to `master` triggers an automated build + deploy to the PROD environment with zero manual intervention, using OIDC (no long-lived secrets).

**Independent Test**: Push a trivial change to `master` → `cd-prod.yml` workflow triggers → both `build` and `deploy` jobs show ✅ → PROD URL serves updated app.

- [x] T014 [P] [US2] Create infra/parameters/prod.bicepparam — Bicep parameter file for PROD: `env='prod'`, `location='denmarkeast'`, `aiQuotaLimit=20`, `aiModelCapacity=10`; `b2cTenant`, `b2cClientId`, `b2cPolicy` injected at runtime from GitHub Actions vars per data-model.md §GitHub Actions Workflow Structure
- [x] T015 [US2] Create .github/workflows/cd-prod.yml — GitHub Actions workflow; triggers: `push: branches: [master]`; jobs: (a) `build` job: checkout, setup-node 20.x with npm cache, `npm ci` + `npm run build -- --mode prod` in frontend/ (injecting all `PROD_VITE_*` GitHub vars as env vars), `npm ci` + `npm run build` in api/, upload artifacts `frontend/dist` and `api/dist`; (b) `deploy` job: `needs: build`, `permissions: id-token: write, contents: read`; steps: download artifacts, `azure/login@v2` with `client-id`, `tenant-id`, `subscription-id` from GitHub vars (OIDC — no secret), capture SWA deployment token via `az staticwebapp secrets list --name ${{ vars.PROD_SWA_NAME }} --resource-group ${{ vars.PROD_RESOURCE_GROUP }} --query "properties.apiKey" -o tsv`, deploy frontend via `azure/static-web-apps-deploy@v1` with captured token, deploy API via `func azure functionapp publish ${{ vars.PROD_FUNC_APP_NAME }} --node` (consistent with T013 local deploy — no manual ZIP packaging required) per data-model.md §GitHub Actions Workflow Structure + research.md Decision 3+4+11

- [x] T020 [US2] One-time PROD infrastructure provisioning — prerequisite gate before cd-prod.yml can succeed; provision PROD Azure resources by running: `az group create --name rg-wordsprout-prod --location denmarkeast` then `az deployment group create --resource-group rg-wordsprout-prod --template-file infra/main.bicep --parameters @infra/parameters/prod.bicepparam b2cTenant=<tenant> b2cClientId=<clientId>`; depends on T011 (main.bicep) and T014 (prod.bicepparam); documented in full in docs/runbook.md §One-time PROD Infrastructure (T017e); this is a one-time manual step — subsequent PROD app code updates are handled automatically by cd-prod.yml

**Checkpoint**: US2 fully functional — PROD deploys automatically on every master push. US3 and US4 can be worked on in parallel.

---

## Phase 5: User Story 3 — Infrastructure Documented and Reproducible (P2)

**Goal**: A complete runbook and allowlist management script that lets a developer with Azure access recreate the environment and manage user access from scratch.

**Independent Test**: Follow docs/runbook.md from top to bottom with no prior knowledge → fully functional environment. Run `.\scripts\manage-allowlist.ps1 -List -Environment dev` → pending requests listed.

- [x] T016 [P] [US3] Create scripts/manage-allowlist.ps1 — PowerShell 7 script with params `-Environment` (dev|prod, required), `-List` switch, `-Approve` switch, `-Email` string, `-Sub` string (B2C object ID / `sub` claim, required with `-Approve`); `-List` queries Cosmos DB container `wordsprout/data` for documents with `type='access_request'` and `status='pending'` via `az cosmosdb sql query`, displaying `email`, `requestedAt`, and document `id` for each result; `-Approve -Email <email> -Sub <b2cObjectId>` locates the pending access_request document by email, creates an `allowlist:<b2cObjectId>` document via `az cosmosdb sql document create` with fields `id=allowlist:<b2cObjectId>`, `userId=<b2cObjectId>`, `type=allowlist`, `email`, `allowedAt`, `createdAt`, `updatedAt`, then updates the access request `status` to `approved`; note: access_request documents use `userId='_access_requests'` (Cosmos partition key grouping, not the user's B2C sub) — admin must look up the B2C object ID in the Azure AD B2C portal (Users tab) before running `-Approve`; includes `az account show` guard to confirm correct subscription; outputs success/failure per action per spec.md §4 + quickstart.md §Testing DEV
- [x] T017 [US3] Create docs/runbook.md — comprehensive infrastructure runbook containing: (a) **Prerequisites** section: required tools and versions; (b) **One-time Azure Setup** section: create B2C tenant (Portal steps), create B2C_1_susi user flow, register wordsprout-dev app (redirect URI, API scope), register wordsprout-prod app, record tenant name + client IDs; (c) **One-time OIDC Setup** section (explicit prerequisite for cd-prod.yml, must be completed before first PROD deploy): create Azure AD App Registration, assign `Contributor` role on `rg-wordsprout-prod`, add federated credential scoped to `repo:<owner>/<repo>:ref:refs/heads/master`, record `AZURE_CLIENT_ID` (application client ID) and `AZURE_TENANT_ID`; (d) **One-time GitHub Setup** section: create repo, configure GitHub Actions Variables (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, all PROD_VITE_* vars, PROD_SWA_NAME, PROD_FUNC_APP_NAME, PROD_RESOURCE_GROUP); (e) **One-time PROD Infrastructure** section: explicit command sequence to provision PROD Azure resources before cd-prod.yml can deploy app code — `az group create --name rg-wordsprout-prod --location denmarkeast` then `az deployment group create --resource-group rg-wordsprout-prod --template-file infra/main.bicep --parameters @infra/parameters/prod.bicepparam b2cTenant=<tenant> b2cClientId=<clientId>`; depends on T014 (prod.bicepparam) and T011 (main.bicep) being complete; (f) **Resource Inventory** section: table of every Azure resource with name, type, resource group, SKU/tier, purpose, and commands used; (g) **Branch Protection** section: how to enable required status checks in GitHub; (h) **Allowlist Management** section: how to use manage-allowlist.ps1 (note the required `-Sub <b2cObjectId>` parameter for approvals); (i) **Secret Rotation** section: steps to rotate cosmos-key and openai-key in Key Vault and force Function App settings refresh; (j) **DEV Deployment** section: cross-reference quickstart.md per spec.md FR-016 FR-017 FR-018 FR-019

**Checkpoint**: US3 fully functional — complete operational documentation exists.

---

## Phase 6: User Story 4 — PR Validation Pipeline (P2)

**Goal**: Every pull request to `master` automatically runs lint, type-check, and unit tests for both projects; failing checks block merge.

**Independent Test**: Open a PR introducing a TypeScript error in either project → `ci.yml` workflow fails → PR shows failing status check.

- [x] T018 [US4] Create .github/workflows/ci.yml — GitHub Actions workflow; name: `CI`; triggers: `pull_request: branches: [master]`; single job `validate` running on `ubuntu-latest`; steps: checkout; setup-node 20.x with npm cache for both package-lock.json files; `npm ci` in frontend/; `npm run lint` in frontend/; `npm run typecheck` in frontend/; `npm test` in frontend/ (vitest run); `npm ci` in api/; `npm run lint` in api/; `npm run typecheck` in api/; `npm test` in api/ (vitest run); all steps use `working-directory`; no Azure credentials or secrets required per spec.md FR-002 FR-003

**Checkpoint**: US4 fully functional — all PRs are validated automatically.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T019 [P] Verify .gitignore completeness — confirm `!.env.*.example` un-ignores example files (T001), that `frontend/dist/` is excluded, that `api/dist/` is excluded, that `infra/` contains no sensitive files to exclude; cross-check against secret-scan.yml patterns in .gitleaks.toml

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — BLOCKS US1 and US2
  - T005–T010 can all run in parallel within Phase 2
  - T011 (main.bicep) must follow T005–T010
- **Phase 3 (US1)**: Depends on Phase 2 (T011 complete)
- **Phase 4 (US2)**: Depends on Phase 2 (T011 complete) — can run in parallel with Phase 3
- **Phase 5 (US3)**: Depends on Phase 3 + Phase 4 being substantially complete (runbook must accurately describe the deployed system)
  - T016 (manage-allowlist.ps1) is independent and can run in parallel with Phase 3/4
- **Phase 6 (US4)**: Independent of Phases 3–5 — can run in parallel with all of them
- **Final Phase**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Requires Foundational phase — no dependency on US2, US3, US4
- **US2 (P1)**: Requires Foundational phase — no dependency on US1, US3, US4
- **US3 (P2)**: Requires US1+US2 substantially complete (documents the actual system) — T016 is independently workable
- **US4 (P2)**: No dependency on US1, US2, or US3 — fully independent

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel
- **Phase 2**: T005, T006, T007, T008, T009, T010 all in parallel; T011 last
- **Phase 3+4**: Once Phase 2 is done, T012/T013 (US1) and T014/T015 (US2) can run in parallel streams
- **Phase 3+6**: T013 and T018 have no shared files — can run simultaneously
- **Phase 5**: T016 and T017 can run in parallel
- **Phase 5+6**: T016/T017 (US3) and T018 (US4) are fully independent

---

## Parallel Example: US1 + US2 simultaneously (after Phase 2)

```
Stream A (US1 — DEV deploy):        Stream B (US2 — PROD CD):
T012 dev.bicepparam              ─┐  T014 prod.bicepparam         ─┐
T013 deploy-dev.ps1              ─┘  T015 cd-prod.yml             ─┘
```

```
Stream C (US4 — PR CI, independent):
T018 ci.yml  [can run from Phase 2 onward, no infra dependency]
```

---

## Implementation Strategy

**MVP scope (US1 only)**: Complete Phases 1–3 to get the DEV environment fully deployable from a local machine. This is a fully working increment — the developer can test the real app against real Azure resources.

**Full delivery order**: Phase 1 → Phase 2 (parallel modules) → Phase 3 + Phase 4 + Phase 6 (three parallel streams) → Phase 5 → Final Phase.

**Total task count**: 20 tasks across 7 phases.

| Phase | Story | Tasks | Parallelisable |
|---|---|---|---|
| Phase 1: Setup | — | T001–T004 | T002, T003 |
| Phase 2: Foundational | — | T005–T011 | T005–T010 |
| Phase 3: DEV Deploy | US1 (P1) | T012–T013 | None |
| Phase 4: PROD CD Pipeline | US2 (P1) | T014, T015, T020 | T014 |
| Phase 5: Runbook + Allowlist | US3 (P2) | T016–T017 | T016 |
| Phase 6: PR CI Pipeline | US4 (P2) | T018 | — |
| Final: Polish | — | T019 | T019 |
