# Implementation Plan: CI/CD Pipeline & Azure Infrastructure Deployment

**Branch**: `003-cicd-azure-infra-deploy` | **Date**: 2026-04-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-cicd-azure-infra-deploy/spec.md`

## Summary

WordSprout has been running exclusively in local mode with all Azure dependencies mocked or bypassed. This feature provisions the complete Azure infrastructure for DEV and PROD environments and wires up CI/CD so that:

- A developer can deploy the DEV environment from their local machine using a single PowerShell script (`scripts/deploy-dev.ps1`), provisioning all resources idempotently via Bicep.
- Merging to `master` automatically builds and deploys the application to PROD via GitHub Actions, using Workload Identity Federation (OIDC) — no long-lived secrets stored anywhere.

Technical approach: Azure Static Web Apps (BYOF) + standalone Flex Consumption Function App per environment; Azure Key Vault with Managed Identity for secrets; Bicep for IaC; one-time B2C tenant setup documented in a runbook. No application code changes required — only new infrastructure, pipeline, and tooling files.

## Technical Context

**Language/Version**: TypeScript 5.x (existing app code, unchanged); PowerShell 7.x (deploy scripts); Bicep ≥ 0.26 (IaC); GitHub Actions YAML (CI/CD)
**Primary Dependencies**: Azure CLI ≥ 2.60, Azure Functions Core Tools v4, Bicep CLI (via `az bicep`), `azure/login@v2`, `azure/static-web-apps-deploy@v1` (GitHub Actions)
**Storage**: Azure Cosmos DB Serverless Core/NoSQL (existing contract, unchanged); Azure Storage (Flex Consumption requirement)
**Testing**: Vitest (existing, no changes); GitHub Actions CI job validates lint + typecheck + tests on every PR
**Target Platform**: Azure Static Web Apps (Free for DEV, Standard for PROD) + Azure Functions Node.js 20 Flex Consumption; GitHub Actions ubuntu-latest runners
**Project Type**: Infrastructure-as-Code + CI/CD pipeline + deployment tooling (no application code changes)
**Performance Goals**: Deploy script completes full DEV provisioning in ≤ 15 minutes on first run; incremental redeploy in ≤ 5 minutes. PROD pipeline completes in ≤ 10 minutes end-to-end.
**Constraints**: $100/month absolute cost ceiling (estimated: ~$15–20/month for both envs); no long-lived secrets in GitHub or source control; offline-first app capability unaffected (infrastructure concern only)
**Scale/Scope**: Private preview, <100 users; two environments (DEV + PROD); one Azure subscription

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **I. Encounter-First** — N/A. This feature adds no vocabulary features. The infrastructure connects existing app features to real Azure services but introduces no app-assigned vocabulary.
- ✅ **II. Learner Ownership** — N/A. No data model changes. User data continues to live in Cosmos DB where users retain full edit and delete rights. Deployment automation has no effect on data ownership.
- ✅ **III. Offline-First** *(NON-NEGOTIABLE)* — Infrastructure changes do not affect offline capability. The PWA service worker, IndexedDB store, and sync queue are unchanged. The app works offline when deployed exactly as it does in local mode.
- ✅ **IV. AI as Assistant** — No new AI calls introduced. The existing AI enrichment path (user-triggered, quota-capped) is enabled by connecting to a real Azure OpenAI resource — but the trigger model, quota cap, and Key Vault-referenced key are all intact. AI is not involved in any auth, deployment, or access-control path.
- ✅ **V. Cost-Conscious** — Fully costed in `research.md`. Estimated combined DEV + PROD cost: **~$15–20/month**. Breakdown: SWA Standard PROD ($9), Cosmos DB Serverless (~$5 peak), OpenAI GPT-4o-mini (~$0.50), Function App Flex (~$0), Key Vault (~$0.02). Well within the $100 ceiling and within the $20–50 target band.

*Post-design re-check*: All constitution gates remain ✅ after Phase 1 design. No new Azure resources add stateful, always-on infrastructure — all compute is serverless/consumption-billed.

## Project Structure

### Documentation (this feature)

```text
specs/003-cicd-azure-infra-deploy/
├── plan.md                  # This file
├── research.md              # Phase 0 — all 12 technical decisions
├── data-model.md            # Phase 1 — Azure resource model + config state
├── quickstart.md            # Phase 1 — deploy guide (DEV + PROD)
├── contracts/
│   └── deployment-contracts.md   # Phase 1 — env var schema, Bicep params, GH Actions vars
└── tasks.md                 # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
infra/                                        [NEW DIRECTORY]
├── main.bicep                                [NEW] Root orchestration template
├── modules/
│   ├── storage.bicep                         [NEW] Storage account for Flex Consumption
│   ├── cosmos.bicep                          [NEW] Cosmos DB account + database + container
│   ├── keyvault.bicep                        [NEW] Key Vault (RBAC) + secrets + role assignments
│   ├── openai.bicep                          [NEW] Azure OpenAI + gpt-4o-mini deployment
│   ├── funcapp.bicep                         [NEW] App Service Plan (Flex) + Function App + MI
│   └── swa.bicep                             [NEW] Static Web App + BYOF backend link
└── parameters/
    ├── dev.bicepparam                        [NEW] DEV environment parameter overrides
    └── prod.bicepparam                       [NEW] PROD environment parameter overrides

scripts/
├── deploy-dev.ps1                            [NEW] Local DEV provisioning + deploy script
└── manage-allowlist.ps1                      [NEW] List pending access requests + approve users

.github/
└── workflows/
    ├── secret-scan.yml                       [EXISTING — no changes]
    ├── ci.yml                                [NEW] PR validation: lint + typecheck + test
    └── cd-prod.yml                           [NEW] Push to master: build + deploy PROD

docs/
└── runbook.md                                [NEW] Infrastructure runbook (one-time setup steps)

frontend/
├── .env.dev.example                          [NEW] DEV env vars template (gitignored: .env.dev)
└── .env.prod.example                         [NEW] PROD env vars template (gitignored: .env.prod)

staticwebapp.config.json                      [MODIFY] Add *.b2clogin.com to CSP connect-src
.gitignore                                    [MODIFY] Add !.env.*.example to un-ignore example files
```

**Structure Decision**: The existing two-project layout (`frontend/` + `api/`) is unchanged. All new files are infrastructure, tooling, and documentation. Application source code in `frontend/src/` and `api/src/` requires no modification — the deployment infrastructure connects the existing code to real Azure resources by injecting correct environment variables.

## Complexity Tracking

> No constitution violations — section intentionally empty.
