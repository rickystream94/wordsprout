# Deployment Contracts: Environment Configuration Schema

> **Historical planning document.** Contracts and example values here reflect the original design (B2C auth, Key Vault secret references, specific resource names). The current implementation uses Entra ID, Managed Identity (no Key Vault), and derives all resource names from [`infra/config.json`](../../../infra/config.json).

**Feature**: 003-cicd-azure-infra-deploy
**Date**: 2026-04-18

> This document defines the interface contracts between deployment tooling and the application runtime: the environment variables each component expects, the Bicep template parameters, and the GitHub Actions variable/secret requirements.

---

## 1. Frontend Build-time Environment Variables (Vite)

Consumed from `.env.<mode>` files at `vite build --mode <mode>` time.
Variables prefixed `VITE_` are embedded into the compiled JS bundle.

```yaml
# frontend/.env.dev  (or .env.prod)
# Gitignored — template committed as .env.dev.example / .env.prod.example

VITE_APP_ENV:
  type: string
  enum: [local, dev, prod]
  required: true
  description: >
    Controls IS_LOCAL / IS_DEV / IS_PROD flags throughout the frontend.
    'local' enables auth bypass and localhost API base URL.

VITE_B2C_TENANT:
  type: string
  required: true (for dev/prod)
  example: wordsproutsso
  description: >
    Azure AD B2C tenant name (without .onmicrosoft.com suffix).
    Used to construct the MSAL authority URL and API scope.

VITE_B2C_POLICY:
  type: string
  required: true (for dev/prod)
  example: B2C_1_susi
  description: >
    Name of the B2C sign-up/sign-in user flow policy.

VITE_B2C_CLIENT_ID:
  type: string
  required: true (for dev/prod)
  example: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  description: >
    Client ID of the B2C app registration for this environment.
    Public value — safe to include in JavaScript bundle.

VITE_REDIRECT_URI:
  type: string
  required: false
  default: window.location.origin
  example: https://swa-wordsprout-dev.azurestaticapps.net
  description: >
    MSAL redirect URI after B2C login. Defaults to current origin.
    Must match a redirect URI configured in the B2C app registration.
```

---

## 2. API Runtime Environment Variables (Azure Function App app settings)

Injected into the Function App process environment by Azure.
Secrets are referenced via Key Vault references and resolved by the Azure platform.

```yaml
APP_ENV:
  type: string
  enum: [local, dev, prod]
  required: true
  description: Controls IS_LOCAL / IS_DEV / IS_PROD in api/src/config/env.ts.

COSMOS_ENDPOINT:
  type: string
  format: uri
  required: true
  example: https://cosmos-wordsprout-dev.documents.azure.com:443/
  description: Cosmos DB account URI. Public, non-secret.

COSMOS_KEY:
  type: string
  required: true
  source: Key Vault reference
  kv_secret_name: cosmos-key
  example: "@Microsoft.KeyVault(SecretUri=https://kv-wordsprt-dev.vault.azure.net/secrets/cosmos-key/)"
  description: >
    Cosmos DB account primary key. Resolved by Azure before injection.
    Application reads process.env['COSMOS_KEY'] — no Key Vault SDK needed.

COSMOS_DATABASE:
  type: string
  required: false
  default: wordsprout
  description: Cosmos DB database name.

COSMOS_CONTAINER:
  type: string
  required: false
  default: data
  description: Cosmos DB container name within the database.

B2C_TENANT:
  type: string
  required: true
  example: wordsproutsso
  description: Azure AD B2C tenant name. Used for JWKS URI construction.

B2C_POLICY:
  type: string
  required: true
  example: B2C_1_susi
  description: B2C user flow name. Used for JWKS URI construction.

B2C_CLIENT_ID:
  type: string
  required: true
  example: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  description: B2C app registration client ID. Used for JWT audience validation.

AZURE_AI_ENDPOINT:
  type: string
  format: uri
  required: true
  example: https://oai-wordsprout-dev.openai.azure.com/
  description: Azure OpenAI account endpoint URI. Public, non-secret.

AZURE_AI_KEY:
  type: string
  required: true
  source: Key Vault reference
  kv_secret_name: openai-key
  example: "@Microsoft.KeyVault(SecretUri=https://kv-wordsprt-dev.vault.azure.net/secrets/openai-key/)"
  description: >
    Azure OpenAI API key. Resolved by Azure before injection.

AZURE_AI_DEPLOYMENT:
  type: string
  required: false
  default: gpt-4o-mini
  description: Azure OpenAI model deployment name.

AI_QUOTA_LIMIT:
  type: integer
  required: false
  default: 20 (prod), 10 (dev)
  description: Maximum AI enrichment calls per user per day.

AzureWebJobsStorage:
  type: string
  required: true
  description: Storage account connection string. Required by Flex Consumption plan.
```

---

## 3. Bicep Template Parameters (`infra/main.bicep`)

```yaml
env:
  type: string
  enum: [dev, prod]
  required: true
  description: Target environment. Controls resource naming and SWA tier.

location:
  type: string
  required: false
  default: resourceGroup().location
  description: Azure region for all resources.

b2cTenant:
  type: string
  required: true
  description: B2C tenant name — stored as a Function App setting.

b2cPolicy:
  type: string
  required: false
  default: B2C_1_susi
  description: B2C user flow name.

b2cClientId:
  type: string
  required: true
  description: B2C app registration client ID for this environment.

aiQuotaLimit:
  type: int
  required: false
  default: 20
  description: AI_QUOTA_LIMIT value to inject into Function App settings.

aiModelCapacity:
  type: int
  required: false
  default: 10
  description: TPM capacity for the gpt-4o-mini model deployment.
```

---

## 4. GitHub Actions Variables and Secrets

### Repository Variables (non-secret, visible in logs)

```yaml
AZURE_CLIENT_ID:
  description: Client ID of the Azure AD App Registration used for OIDC.

AZURE_TENANT_ID:
  description: Azure AD tenant ID (not B2C — the main AAD tenant).

AZURE_SUBSCRIPTION_ID:
  description: Azure subscription ID.
  value: 86264ae5-dd19-43d5-a842-4163c5c245c4

PROD_VITE_APP_ENV:
  value: prod

PROD_VITE_B2C_TENANT:
  description: B2C tenant name for PROD.

PROD_VITE_B2C_POLICY:
  description: B2C policy name (B2C_1_susi).

PROD_VITE_B2C_CLIENT_ID:
  description: Client ID of the PROD B2C app registration.

PROD_VITE_REDIRECT_URI:
  description: PROD redirect URI (matches B2C app registration).

PROD_SWA_NAME:
  value: swa-wordsprout-prod

PROD_FUNC_APP_NAME:
  value: func-wordsprout-prod

PROD_RESOURCE_GROUP:
  value: rg-wordsprout-prod
```

### Repository Secrets

```yaml
# No GitHub Secrets are required.
# All sensitive values are stored in Azure Key Vault.
# GitHub Actions authenticates to Azure via OIDC (no client secret).
# The SWA deployment token is retrieved at runtime via az CLI.
```

---

## 5. Local Developer Setup (`.env.dev` content)

Template committed as `frontend/.env.dev.example`:

```dotenv
# WordSprout DEV environment — frontend build variables
# Copy to .env.dev and fill in values. DO NOT COMMIT .env.dev.
VITE_APP_ENV=dev
VITE_B2C_TENANT=<b2c-tenant-name>
VITE_B2C_POLICY=B2C_1_susi
VITE_B2C_CLIENT_ID=<dev-b2c-app-client-id>
VITE_REDIRECT_URI=https://swa-wordsprout-dev.azurestaticapps.net
```

---

## 6. Content Security Policy Changes (`staticwebapp.config.json`)

The current CSP `connect-src` directive must be expanded to allow B2C authentication traffic:

```json
Current:
"connect-src 'self' https://login.microsoftonline.com"

Required:
"connect-src 'self' https://login.microsoftonline.com https://*.b2clogin.com"
```

Rationale: MSAL.js issues OIDC/OAuth requests to `https://<tenant>.b2clogin.com` for token acquisition and silent renewal. Without this, B2C authentication is blocked by the CSP.
