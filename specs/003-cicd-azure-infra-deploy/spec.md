# Feature Specification: CI/CD Pipeline & Azure Infrastructure Deployment

> **Historical planning document.** This spec was written during the initial design phase and reflects decisions made at that time. Resource names, regions, auth approach (B2C → Entra ID), and infrastructure choices have evolved. For current operational state, see [`docs/runbook.md`](../../docs/runbook.md) and [`infra/config.json`](../../infra/config.json).

**Feature Branch**: `003-cicd-azure-infra-deploy`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description: "Setup CI/CD on GitHub, Azure infrastructure to host the app, follow security best practices, deploy MVP to DEV locally and PROD on push to master."

---

## Current State of Mocked / Bypassed Components

> This section documents what is bypassed or mocked in `local` mode today and how each feature works end-to-end once real Azure resources are connected. It serves as the reference for what "going live" means for each component.

### 1. Authentication & Authorisation (AuthN/AuthZ)

**Local behaviour**: When `APP_ENV=local`, all auth is bypassed:
- **Frontend** (`AuthProvider.tsx`): `IS_LOCAL` causes `effectivelyAuthenticated` to always be `true`, hardcoded `userId = 'test-user-local'`, `email = 'dev@local'`. MSAL is initialised but never called.
- **API** (`authorise.ts`): `IS_LOCAL` returns a hardcoded `LOCAL_IDENTITY` object (`sub: 'test-user-local'`, `email: 'dev@local'`) and skips all JWT validation.
- **Token acquisition** (`api.ts`): Returns the string `'local-bypass-token'` instead of a real MSAL access token.

**Real behaviour (dev/prod)**: Frontend acquires a JWT access token from Azure AD B2C via MSAL (redirect flow). The token is sent as a `Bearer` header on every API call. The API middleware validates the JWT signature against the B2C tenant's JWKS endpoint (cached), decodes it, then performs a Cosmos DB point-read on the `allowlist:<userId>` document to confirm the user has been granted access. If no allowlist entry is found, the API returns `403`.

**Config required**: `VITE_B2C_TENANT`, `VITE_B2C_POLICY`, `VITE_B2C_CLIENT_ID`, `VITE_REDIRECT_URI` (frontend); `B2C_TENANT`, `B2C_POLICY`, `B2C_CLIENT_ID` (API).

---

### 2. Storage / Database (Cosmos DB)

**Local behaviour**: `IS_LOCAL` causes `cosmos.ts` to instantiate `createMockCosmosClient()` — an in-memory `Map`-based stub. All reads and writes are ephemeral; data is lost when the Function host restarts. No network calls are made.

**Real behaviour (dev/prod)**: `buildRealClient()` connects to an Azure Cosmos DB Serverless account using `COSMOS_ENDPOINT` and `COSMOS_KEY`. All phrasebook entries, enrichments, access requests, allowlist records, and user quota data are stored in a single container (`wordsprout/data`) partitioned by `userId`.

**Config required**: `COSMOS_ENDPOINT`, `COSMOS_KEY` (or Managed Identity), `COSMOS_DATABASE`, `COSMOS_CONTAINER`.

---

### 3. AI Enrichment (Azure OpenAI)

**Local behaviour**: `IS_LOCAL` in `ai.ts` returns a `buildLocalEnrichment()` stub with hardcoded placeholder sentences, synonyms, antonyms, and register. No call is made to Azure OpenAI.

**Real behaviour (dev/prod)**: The `enrich` Azure Function calls the Azure OpenAI Chat Completions API using `AZURE_AI_ENDPOINT` and `AZURE_AI_KEY`. A structured prompt is sent requesting JSON enrichment data (example sentences, synonyms, antonyms, register, collocations, false-friend warning). The response is sanitised via `isomorphic-dompurify` before being stored in Cosmos DB.

**Config required**: `AZURE_AI_ENDPOINT`, `AZURE_AI_KEY`, `AZURE_AI_DEPLOYMENT` (default: `gpt-4o-mini`), `AI_QUOTA_LIMIT`.

---

### 4. User Allow-listing (Access Control)

**Local behaviour**: The in-memory Cosmos mock always returns `null` for allowlist point-reads, but since auth is fully bypassed in `local`, the allowlist check never runs.

**Real behaviour (dev/prod)**: Access is controlled by the presence of an `allowlist:<userId>` document in Cosmos DB. New users submit an access request via the `POST /api/access-requests` endpoint (unauthenticated). An administrator approves users by running `scripts/manage-allowlist.ps1` — a CLI helper script committed to the repository that queries pending access requests from Cosmos DB and creates allowlist documents using the `az cosmosdb` CLI. The script supports `-List` (view pending requests) and `-Approve -Email <email> -Sub <b2cObjectId>` (grant access) operations. The `-Sub` parameter is required because access request documents store `userId: '_access_requests'` (a Cosmos partition key grouping), not the user's B2C object ID (`sub` claim) — the admin must look up the B2C object ID in the Azure portal (Azure AD B2C → Users) and supply it explicitly. No additional Azure resources are required.

---

### 5. Offline Sync Queue

**Local behaviour**: The sync queue (`sync.ts`) uses IndexedDB (Dexie.js) and is functional in `local` mode. Pending mutations are replayed against `http://localhost:7071/api` with the `local-bypass-token` auth header.

**Real behaviour (dev/prod)**: Same behaviour, but mutations are replayed against the Static Web App's `/api` proxy (which routes to the deployed Azure Function App). The bearer token is a real B2C JWT acquired by MSAL.

---

## User Scenarios & Testing

### User Story 1 — Developer Deploys to DEV from Local Machine (Priority: P1)

A developer has cloned the repository and wants to stand up or update the full DEV environment (Azure infrastructure + application) without relying on GitHub Actions. Running a single local script provisions all required Azure resources (if not already present) and deploys the latest code.

**Why this priority**: This is the foundational "first deployment" path. Until DEV is running on real Azure resources, no other story can be validated with real data or real auth.

**Independent Test**: A developer with the correct Azure credentials runs the deployment script on a fresh machine and the app is accessible at the DEV URL, authentication works against B2C, and a phrasebook entry can be created and retrieved.

**Acceptance Scenarios**:

1. **Given** a developer has Azure CLI / Az PowerShell authenticated with the correct subscription, **When** they run the local deploy script targeting `dev`, **Then** all Azure resources are provisioned (if absent) and the latest frontend and API builds are deployed — the script completes with a zero exit code.
2. **Given** DEV resources already exist, **When** the deploy script is run again, **Then** only the application artefacts are redeployed (not the infrastructure) — idempotent behaviour with no errors.
3. **Given** the deploy script has completed, **When** the developer opens the DEV URL in a browser, **Then** the app loads, the B2C login page appears, and upon authentication the home page is shown.

---

### User Story 2 — Automated PROD Deployment via GitHub Actions (Priority: P1)

When code is merged to `master`, a GitHub Actions workflow automatically builds and deploys the application to the PROD environment. No manual steps are required beyond the merge.

**Why this priority**: This is the core CI/CD requirement. Without it, every production release requires manual effort and is error-prone.

**Independent Test**: A code change is merged to `master`. The GitHub Actions workflow triggers, completes successfully, and the PROD URL reflects the change within 10 minutes.

**Acceptance Scenarios**:

1. **Given** a pull request is merged to `master`, **When** GitHub Actions runs the deploy workflow, **Then** the frontend build and API are deployed to PROD and the workflow exits with status `success`.
2. **Given** the build step fails (e.g., TypeScript errors), **When** the workflow runs, **Then** the deploy step is skipped and the workflow exits with status `failure` — PROD is not updated.
3. **Given** the deploy workflow has completed successfully, **When** a user visits the PROD URL, **Then** the updated version of the app is served.

---

### User Story 3 — Azure Infrastructure is Documented and Reproducible (Priority: P2)

All Azure resources created for DEV and PROD are documented in a runbook that describes each resource, its purpose, and the exact steps used to create and configure it. A new team member (or the same developer on a fresh machine) can follow the runbook to recreate the environment from scratch.

**Why this priority**: Without documentation, the setup is tribal knowledge. The runbook is essential for disaster recovery and onboarding.

**Independent Test**: A team member who was not present at initial setup follows the runbook and successfully provisions a working environment by following the documented steps alone.

**Acceptance Scenarios**:

1. **Given** the runbook exists, **When** a developer follows it step by step, **Then** a fully functional environment is provisioned without requiring external guidance.
2. **Given** all Azure resources were created following the runbook, **When** the runbook is reviewed, **Then** every resource is listed with its resource group, tier/SKU, purpose, and any manual configuration steps.
3. **Given** the infrastructure setup, **When** a security review is performed, **Then** no secrets are stored in plain text; all credentials use Managed Identity or Azure Key Vault where applicable.

---

### User Story 4 — PR Validation Pipeline (Priority: P2)

When a pull request is opened or updated against `master`, a GitHub Actions workflow runs automated checks (lint, type-check, unit tests) on the changed code. The checks must pass before the PR can be merged.

**Why this priority**: Prevents regressions from reaching `master` and enforces code quality standards automatically.

**Independent Test**: Open a PR with a deliberate TypeScript error. The CI workflow fails, and the PR is marked as blocked from merging.

**Acceptance Scenarios**:

1. **Given** a PR is opened against `master`, **When** the CI workflow runs, **Then** it executes lint, type-check, and unit tests for both `frontend/` and `api/`.
2. **Given** any check fails, **When** the workflow completes, **Then** the PR is marked as failing and cannot be merged via branch protection rules.
3. **Given** all checks pass, **When** the workflow completes, **Then** the PR is marked as passing and can be merged.

---

### Edge Cases

- What happens when the deployment script is run without the required Azure credentials? The script should exit early with a clear error message identifying the missing authentication.
- What happens if an Azure resource already exists with a different configuration when the script is run? The script should be idempotent — existing resources are not destroyed; only app artefacts are redeployed.
- What happens if the GitHub Actions workflow runs before the PROD infrastructure is provisioned? The workflow should fail with a clear error message rather than creating partial deployments.
- What happens if a secret rotation is required? The runbook should document the process for rotating secrets and updating Key Vault without downtime.

---

## Requirements

### Functional Requirements

#### CI/CD Pipeline

- **FR-001**: The repository MUST have a GitHub Actions workflow that triggers on merge/push to `master` and deploys the application to PROD.
- **FR-002**: The repository MUST have a GitHub Actions workflow that triggers on pull requests to `master` and runs lint, type-check, and unit tests for `frontend/` and `api/`.
- **FR-003**: The PROD deploy workflow MUST only execute the deploy step if the build and test steps pass.
- **FR-004**: A local script MUST exist that provisions all DEV Azure infrastructure (idempotently) and deploys the latest application code to DEV; the script MUST support being run multiple times without destroying existing data or resources.

#### Azure Infrastructure

- **FR-006**: The frontend MUST be hosted on Azure Static Web Apps (consistent with `staticwebapp.config.json` already in the repository).
- **FR-007**: The API (Azure Functions Node.js v4) MUST be deployed as a standalone Azure Function App (Flex Consumption plan) linked to the Static Web App as a BYOF (Bring Your Own Functions) backend — this gives full Managed Identity and Key Vault reference support (see research.md Decision 2).
- **FR-008**: A single Azure Cosmos DB Serverless account MUST be provisioned with the `wordsprout` database and `data` container, shared between DEV and PROD environments (separate accounts per environment).
- **FR-009**: Azure AD B2C MUST be configured with a tenant, a sign-up/sign-in user flow policy, and a registered application matching the configuration expected by `msalConfig.ts` and `authorise.ts`.
- **FR-010**: An Azure OpenAI resource MUST be provisioned and a `gpt-4o-mini` model deployment created to support AI enrichment.
- **FR-011**: All application secrets (Cosmos DB key, Azure OpenAI key, B2C client secrets) MUST be stored in Azure Key Vault; the Function App MUST access them via Managed Identity, not hardcoded environment variables.

#### Security

- **FR-012**: The Function App MUST use a System-Assigned Managed Identity wherever possible; RBAC roles MUST be assigned in preference to connection strings or API keys.
- **FR-013**: No secrets or credentials MUST be committed to source control; the secret-scan workflow already in place MUST be kept and enforced.
- **FR-014**: GitHub Actions MUST use Federated Credentials (OpenID Connect / Workload Identity Federation) to authenticate to Azure — no long-lived service principal secrets stored as GitHub Secrets.
- **FR-015**: The Static Web App MUST enforce HTTPS only; the existing security headers in `staticwebapp.config.json` MUST be preserved in all environments.

#### Documentation & Runbook

- **FR-016**: A runbook document MUST be created that records every Azure resource created, its purpose, the commands/steps used to create it, and any manual post-creation configuration.
- **FR-017**: The runbook MUST describe the one-time setup steps that cannot be automated (e.g., B2C tenant creation, GitHub repository creation, federated credential binding).
- **FR-018**: The runbook MUST document the allowlist management workflow: how to list pending access requests and how to approve a user using `scripts/manage-allowlist.ps1`.
- **FR-019**: Environment-specific configuration values (non-secret) MUST be documented so that the app can be run against DEV resources from a local machine.

### Key Entities

- **DEV Environment**: A fully isolated set of Azure resources (Static Web App, Cosmos DB, Function App, OpenAI) used for development and testing. Deployed manually via local script.
- **PROD Environment**: A separate set of Azure resources for the live application. Deployed automatically via GitHub Actions on push to `master`.
- **GitHub Actions Workflow (CI)**: Runs on PRs — lint, type-check, unit tests. Does not deploy.
- **GitHub Actions Workflow (CD)**: Runs on push to `master` — builds and deploys to PROD.
- **Local Deploy Script**: A PowerShell script (`scripts/deploy-dev.ps1`) that provisions DEV infrastructure and deploys the app. Requires a locally authenticated Azure session.
- **Allowlist Management Script**: A PowerShell script (`scripts/manage-allowlist.ps1`) that lists pending access requests and approves users by creating allowlist documents in Cosmos DB via the `az cosmosdb` CLI.
- **Runbook**: A markdown document in the repository recording all infrastructure setup steps, resource inventory, and operational procedures.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A developer can run the local deploy script on a fresh machine and have the DEV environment fully operational (frontend accessible, auth working, data persisting) within 30 minutes, following only the runbook and the script's own output.
- **SC-002**: After a merge to `master`, the PROD application is updated and accessible within 10 minutes, with no manual intervention.
- **SC-003**: A PR with a failing TypeScript error is blocked from merging — the CI workflow reports failure within 5 minutes of the PR being opened or updated.
- **SC-004**: Zero secrets or credentials are committed to the repository; the secret-scan workflow passes on every push.
- **SC-005**: The runbook is complete enough that a team member with Azure access but no prior knowledge of this project can follow it and provision a working environment without external help.
- **SC-006**: All Azure resources can be identified by environment (`dev`/`prod`) using consistent naming conventions and resource tags.

---

## Assumptions

- The user will create the GitHub repository manually before the CI/CD pipeline is configured; the pipeline setup assumes the remote already exists.
- Azure AD B2C tenant (`3482ae78-3e1a-4c24-ad03-97b471015836`) already exists and is shared between DEV and PROD; no tenant creation is required. The `B2C_1_susi` sign-up/sign-in user flow is assumed to already exist in this tenant.
- DEV and PROD will share the same Azure AD B2C tenant (`3482ae78-3e1a-4c24-ad03-97b471015836`) using separate application registrations and redirect URIs per environment.
- The API is deployed as a standalone Flex Consumption Function App linked to the Static Web App as a BYOF backend (see research.md Decision 2); the SWA managed Functions approach was rejected because it does not support Key Vault references or System-Assigned Managed Identity.
- A single Azure subscription (`86264ae5-dd19-43d5-a842-4163c5c245c4`) is used for both DEV and PROD, isolated by resource group naming (e.g., `rg-wordsprout-dev`, `rg-wordsprout-prod`).
- All Azure resources are deployed to the **Denmark East** (`denmarkeast`) region.
- The existing `staticwebapp.config.json` security headers are considered production-ready and will be preserved as-is.
- Cosmos DB will initially use an account key (stored in Key Vault) for the Function App connection; migration to Managed Identity RBAC can follow as a hardening step once the basic deployment is working.
- The `gpt-4o-mini` model deployment name in Azure OpenAI matches the existing `AZURE_AI_DEPLOYMENT` default.
- Branch protection rules on `master` (requiring the CI workflow to pass before merge) are configured in GitHub — this is a one-time manual setup step documented in the runbook.

## Clarifications

### Session 2026-04-18

- Q: What Azure subscription ID should be targeted for all Azure resources? → A: `86264ae5-dd19-43d5-a842-4163c5c245c4`
- Q: How should the administrator approve users requesting access to the app? → A: Helper script in repo (`scripts/manage-allowlist.ps1`) — queries pending requests and creates allowlist documents via `az cosmosdb` CLI.
- Q: Which Azure region should all resources be deployed to? → A: Denmark East (`denmarkeast`).
