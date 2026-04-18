# Research: CI/CD Pipeline & Azure Infrastructure Deployment

**Feature**: 003-cicd-azure-infra-deploy
**Date**: 2026-04-18
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: Infrastructure-as-Code Tool

**Decision**: Bicep (Azure Resource Manager DSL)

**Rationale**:
- Native Azure-first language — no external state backend (unlike Terraform), no vendor toolchain to install beyond the Azure CLI (which auto-uses Bicep).
- Cleaner syntax than ARM JSON with full ARM resource coverage.
- `az deployment group create --template-file main.bicep` is a single command that works idempotently.
- Aligns with the constitution's preference for minimal tooling.

**Alternatives considered**:
- *Terraform*: Adds HCL, Terraform Cloud or local state file management, a separate CLI binary. Unnecessary complexity for a personal-scale project.
- *Azure Developer CLI (azd)*: Abstracts Bicep well but adds another tool and enforces specific project conventions. Acceptable but overkill here; raw Bicep is simpler.
- *Pulumi*: TypeScript-native IaC — appealing given the stack, but no advantage over Bicep for Azure-only infrastructure.

---

## Decision 2: API Deployment Model — SWA Managed Functions vs. Standalone Function App (BYOF)

**Decision**: Standalone Azure Function App (Flex Consumption plan) linked to SWA as a BYOF backend

**Rationale**:
- SWA managed Functions do not support Key Vault references in application settings (the `@Microsoft.KeyVault(SecretUri=...)` syntax is an App Service / standalone Functions feature, not available on SWA managed Functions).
- SWA managed Functions do not expose a directly addressable Function App resource, making it impossible to assign a System-Assigned Managed Identity for Key Vault access at the platform level.
- BYOF gives full control over the Function App: Managed Identity assignment, Key Vault references, deployment profiles, scaling configuration.
- The existing `api/` folder structure (Node.js v4 Functions, `host.json`) is 100% compatible with BYOF — no code changes required.

**Alternatives considered**:
- *SWA managed Functions*: Simpler deployment (single step), but cannot satisfy FR-011 (secrets in Key Vault via Managed Identity) without custom code to fetch secrets at runtime. Rejected on security grounds.
- *Standalone Function App with consumption plan (legacy)*: Supported but Flex Consumption is the modern successor with better cold-start behaviour and per-instance billing.

---

## Decision 3: GitHub Actions Authentication to Azure

**Decision**: Workload Identity Federation (OIDC) via Azure AD App Registration + federated credential

**Rationale**:
- Satisfies FR-014 (no long-lived service principal secrets in GitHub Secrets).
- The `azure/login@v2` action supports OIDC federation natively: the workflow provides `client-id`, `tenant-id`, and `subscription-id` as non-secret GitHub Variables; no client secret is ever created.
- The federated credential is scoped to `repo:<owner>/<repo>:ref:refs/heads/master` — only PROD deploys from `master` get the credential.
- A separate federated credential scoped to `repo:<owner>/<repo>:environment:dev` is not needed since DEV is deployed locally only.

**Alternatives considered**:
- *Service principal client secret in GitHub Secrets*: Rejected (violates FR-014). Long-lived, hard to rotate.
- *Managed Identity on a self-hosted GitHub runner*: Overkill for a personal project; adds infrastructure cost.

---

## Decision 4: SWA Deployment Token Strategy

**Decision**: Retrieve the SWA deployment token at runtime in the GitHub Actions workflow using `az staticwebapp secrets list`, rather than storing it as a GitHub Secret

**Rationale**:
- The SWA deployment token is a long-lived credential by nature, but its exposure risk is reduced when it is never stored — it is fetched from Azure ARM at deploy time using the already-authenticated OIDC session.
- Workflow step: `az staticwebapp secrets list --name swa-wordsprout-prod --resource-group rg-wordsprout-prod --query "properties.apiKey" -o tsv` → pipe to `azure/static-web-apps-deploy@v1`.
- If the SWA is recreated, the token changes automatically — no GitHub Secret to update.

**Alternatives considered**:
- *Store deployment token as `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub Secret*: Conventional and simpler, but is a long-lived secret in GitHub. Rejected in favour of the OIDC-runtime-fetch approach for stricter compliance with FR-014.

---

## Decision 5: Secrets Management in the Function App

**Decision**: Azure Key Vault (Standard tier, RBAC authorization model) with Key Vault references in Function App application settings

**Rationale**:
- Key Vault references (`@Microsoft.KeyVault(SecretUri=https://kv-wordsprt-env.vault.azure.net/secrets/cosmos-key/)`) are resolved by the Azure Functions platform before injecting the value as an environment variable. The application code reads `process.env['COSMOS_KEY']` unchanged — no code changes needed.
- RBAC authorization mode (vs. vault access policies) is the modern approach; access is managed via Azure RBAC role assignments.
- The Function App's System-Assigned Managed Identity is assigned the `Key Vault Secrets User` role on the Key Vault — least-privilege read-only access.

**Secrets stored in Key Vault**:
| Secret Name | Value |
|-------------|-------|
| `cosmos-key` | Cosmos DB account primary key |
| `openai-key` | Azure OpenAI API key |

**Non-secrets stored directly in Function App settings** (public configuration):
- `COSMOS_ENDPOINT` — public Cosmos DB URI
- `COSMOS_DATABASE`, `COSMOS_CONTAINER` — database/container names
- `B2C_TENANT`, `B2C_POLICY`, `B2C_CLIENT_ID` — B2C public configuration
- `AZURE_AI_ENDPOINT` — public OpenAI endpoint URL
- `AZURE_AI_DEPLOYMENT`, `AI_QUOTA_LIMIT` — model and quota config
- `APP_ENV` — environment identifier

**Alternatives considered**:
- *Store all config (including secrets) in GitHub Secrets and inject at deploy time*: Doesn't satisfy FR-011 (requires manual rotation, secrets exposed in workflow logs if not masked).
- *Fetch secrets at runtime using `@azure/identity` `DefaultAzureCredential` + `SecretClient`*: More code; requires SDK changes. The Key Vault reference platform feature is simpler and has no app code impact.

---

## Decision 6: Cosmos DB Authentication

**Decision**: Account key stored in Key Vault (initial); Managed Identity RBAC noted as a hardening follow-up

**Rationale**:
- The existing `cosmos.ts` uses `new CosmosClient({ endpoint, key })`. Key Vault references mean the key is injected securely without code changes.
- Migrating to Managed Identity (`DefaultAzureCredential`) requires replacing the `CosmosClient` constructor and assigning `Cosmos DB Built-in Data Contributor` RBAC on the Cosmos account — achievable but deferred to avoid scope creep.
- The spec assumption explicitly accepts this: "migration to Managed Identity RBAC can follow as a hardening step".

**Future hardening**: Assign `Cosmos DB Built-in Data Contributor` role to the Function App MI on the Cosmos account; update `cosmos.ts` to use `DefaultAzureCredential`.

---

## Decision 7: Azure OpenAI — Per-Environment vs. Shared

**Decision**: Separate Azure OpenAI resource per environment (DEV and PROD)

**Rationale**:
- Separate resources provide billing isolation and quota isolation between environments.
- Azure OpenAI is pay-per-token (Global Standard GPT-4o-mini) — negligible cost at this scale.
- Sharing one resource would require careful quota management to avoid DEV testing exhausting PROD quota.
- Bicep can provision both with the same module, parameterised by environment.

**Alternatives considered**:
- *Single shared OpenAI resource*: Simpler, but no quota isolation. Rejected.

---

## Decision 8: Environment Strategy

**Decision**: Two separate resource groups (`rg-wordsprout-dev`, `rg-wordsprout-prod`) in the **Denmark East** (`denmarkeast`) region, each with a fully isolated set of Azure resources, both in subscription `86264ae5-dd19-43d5-a842-4163c5c245c4`

**Rationale**:
- Complete data and cost isolation between environments.
- Easy to tear down DEV independently without risk to PROD.
- Denmark East (`denmarkeast`) is the target region — explicitly confirmed.
- SWA preview environments (staging slots) are a Standard plan feature and better suited to short-lived feature previews — not to permanent DEV/PROD separation.

**Naming convention** (follows Azure recommended resource abbreviations):
| Resource type | DEV name | PROD name |
|---|---|---|
| Resource Group | `rg-wordsprout-dev` | `rg-wordsprout-prod` |
| Static Web App | `swa-wordsprout-dev` | `swa-wordsprout-prod` |
| Function App | `func-wordsprout-dev` | `func-wordsprout-prod` |
| Storage Account | `stwordsproutdev` | `stwordsproutprod` |
| Cosmos DB Account | `cosmos-wordsprout-dev` | `cosmos-wordsprout-prod` |
| Key Vault | `kv-wordsprt-dev` | `kv-wordsprt-prod` |
| Azure OpenAI | `oai-wordsprout-dev` | `oai-wordsprout-prod` |
| App Service Plan | `plan-wordsprout-dev` | `plan-wordsprout-prod` |

All resources tagged: `Environment=dev|prod`, `Project=wordsprout`.

---

## Decision 9: Azure Static Web App Tier

**Decision**: Free tier for DEV; Standard tier for PROD

**Rationale**:
- DEV has no custom domain requirement; Free tier is sufficient.
- PROD requires Standard for custom domain support and enhanced security capabilities.
- Cost saving: `$0/month (DEV SWA) + $9/month (PROD SWA)` vs `$18/month (both Standard)`.

---

## Decision 10: Frontend Environment Variables

**Decision**: Vite `--mode` flag with `.env.<mode>` files; `.env.dev` and `.env.prod` gitignored, `.env.dev.example` and `.env.prod.example` committed

**Rationale**:
- Vite natively supports `.env.<mode>` files loaded by `vite build --mode <mode>`.
- `.env.dev` and `.env.prod` are already covered by the `.gitignore` pattern `.env.*`.
- Example files (`!.env.*.example`) committed to guide developers — `.gitignore` must be updated to un-ignore `*.example` variants.
- For GitHub Actions PROD deploy: `VITE_*` values injected as environment variables in the workflow step (B2C tenant name, policy, client ID are non-secret public values → GitHub Variables, not Secrets).

---

## Decision 11: Function App Deployment Method

**Decision**: `func azure functionapp publish <app-name> --node` (Azure Functions Core Tools) for both local DEV deploy and GitHub Actions PROD deploy

**Rationale**:
- `func azure functionapp publish` handles build + packaging + upload automatically for both local and CI environments.
- Using the same deployment method for DEV and PROD eliminates asymmetric failure modes where a deployment works locally but fails in CI (or vice versa).
- GitHub Actions PROD workflow installs Functions Core Tools (`npm install -g azure-functions-core-tools@4`) as a workflow step before publishing — the overhead is minimal.
- The previously considered `az functionapp deployment source config-zip` approach was rejected because it requires manually constructing a ZIP that includes `node_modules`, adding fragility and inconsistency with the local deploy path.

**Alternatives considered**:
- `Azure/functions-action@v1`: Uses publish profile (long-lived credential). Rejected per FR-014.
- `az functionapp deployment source config-zip`: Rejected — requires manual ZIP construction including `node_modules`; inconsistent with T013 local deploy method.

---

## Decision 12: B2C Tenant Scope

**Decision**: One shared Azure AD B2C tenant, two separate App Registrations (one per environment)

**Rationale**:
- B2C tenant creation is manual and regional; creating two tenants doubles the management overhead.
- Separate App Registrations per environment isolate redirect URIs and client IDs.
- The `B2C_1_susi` policy name can be shared across registrations; redirect URIs are environment-specific.

**One-time manual steps** (documented in runbook):
1. Create B2C tenant (Azure Portal — cannot be automated via Bicep)
2. Create sign-up/sign-in (SUSI) user flow: `B2C_1_susi`
3. Register DEV app, set redirect URI to `https://swa-wordsprout-dev.azurestaticapps.net`
4. Register PROD app, set redirect URI to PROD domain
5. Expose an API scope `user` on the PROD app registration; grant it to the app
6. Copy tenant name, policy name, and client IDs to the respective `.env.dev` / `.env.dev.example` and GitHub Variables

---

## Cost Estimate

| Resource | DEV/month | PROD/month | Notes |
|---|---|---|---|
| Static Web App (Free/Standard) | $0 | $9 | Standard for PROD custom domain |
| Function App (Flex Consumption) | ~$0 | ~$0 | Pay-per-execution; <1M at this scale |
| Storage Account (Flex Functions) | ~$0.01 | ~$0.01 | Minimal at this scale |
| Cosmos DB Serverless | ~$1–3 | ~$2–5 | Pay-per-request |
| Key Vault Standard | ~$0.01 | ~$0.01 | ~300 operations/day |
| Azure OpenAI GPT-4o-mini | ~$0.01 | ~$0.50 | 20 enrichments/user/day cap |
| **Total** | **~$1–3** | **~$12–15** | Well within $100 ceiling |

Both environments combined: **~$13–18/month** — within the $20–50 target band. ✅
