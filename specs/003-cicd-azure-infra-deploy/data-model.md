# Data Model: Azure Infrastructure & Configuration

> **Historical planning document.** Resource names, regions, Key Vault references, and auth parameters reflected here were accurate at spec time. The current deployed topology no longer includes Key Vault, uses Entra ID instead of B2C, and sources all names/locations from [`infra/config.json`](../../infra/config.json). See [`docs/runbook.md`](../../docs/runbook.md) for the current resource inventory.

**Feature**: 003-cicd-azure-infra-deploy
**Date**: 2026-04-18

> This document describes the Azure resource model, configuration model, and deployment artefact structure for the WordSprout infrastructure. It replaces the traditional database schema for this infrastructure-focused feature.

---

## Azure Resource Model

### DEV Environment

**Resource Group**: `rg-wordsprout-dev`
**Location**: `denmarkeast`
**Tags**: `Environment=dev`, `Project=wordsprout`

```
rg-wordsprout-dev
├── swa-wordsprout-dev              Microsoft.Web/staticSites
│   Tier: Free
│   Region: denmarkeast
│   Linked backend: func-wordsprout-dev (BYOF)
│   System-Assigned MI: enabled
│
├── plan-wordsprout-dev             Microsoft.Web/serverfarms
│   Kind: functionapp (Flex Consumption)
│   SKU: FlexConsumption
│
├── func-wordsprout-dev             Microsoft.Web/sites (kind=functionapp,linux)
│   Runtime: node 20
│   Functions version: ~4
│   Plan: plan-wordsprout-dev
│   System-Assigned MI: enabled
│   App Settings:
│     APP_ENV                  = dev
│     AzureWebJobsStorage      = (connection string to stwordsproutdev)
│     COSMOS_ENDPOINT          = https://cosmos-wordsprout-dev.documents.azure.com:443/
│     COSMOS_KEY               = @Microsoft.KeyVault(SecretUri=...)
│     COSMOS_DATABASE          = wordsprout
│     COSMOS_CONTAINER         = data
│     B2C_TENANT               = <b2c-tenant-name>
│     B2C_POLICY               = B2C_1_susi
│     B2C_CLIENT_ID            = <dev-b2c-app-client-id>
│     AZURE_AI_ENDPOINT        = https://oai-wordsprout-dev.openai.azure.com/
│     AZURE_AI_KEY             = @Microsoft.KeyVault(SecretUri=...)
│     AZURE_AI_DEPLOYMENT      = gpt-4o-mini
│     AI_QUOTA_LIMIT           = 10
│
├── stwordsproutdev                 Microsoft.Storage/storageAccounts
│   Kind: StorageV2
│   SKU: Standard_LRS
│   Purpose: Required by Flex Consumption plan
│
├── cosmos-wordsprout-dev           Microsoft.DocumentDB/databaseAccounts
│   API: Core/NoSQL
│   Capacity mode: Serverless
│   Backup: Continuous (7 days, included)
│   Resources:
│   └── Database: wordsprout
│       └── Container: data
│           Partition key: /userId
│           No throughput (serverless)
│
├── kv-wordsprt-dev                 Microsoft.KeyVault/vaults
│   SKU: Standard
│   Authorization: RBAC (enableRbacAuthorization: true)
│   Soft-delete: enabled (7 days for dev)
│   Purge protection: disabled (dev only)
│   Role assignments:
│   └── func-wordsprout-dev (MI) → Key Vault Secrets User
│
│   Secrets:
│   ├── cosmos-key           Cosmos DB account primary key
│   └── openai-key           Azure OpenAI API key
│
└── oai-wordsprout-dev              Microsoft.CognitiveServices/accounts
    Kind: OpenAI
    SKU: S0
    Model deployments:
    └── gpt-4o-mini
        Model: gpt-4o-mini
        Version: 2024-07-18
        Deployment type: GlobalStandard
        Capacity: 1 (TPM, minimal for dev)
```

---

### PROD Environment

**Resource Group**: `rg-wordsprout-prod`
**Location**: `denmarkeast`
**Tags**: `Environment=prod`, `Project=wordsprout`

```
rg-wordsprout-prod
├── swa-wordsprout-prod             Microsoft.Web/staticSites
│   Tier: Standard
│   Region: denmarkeast
│   Linked backend: func-wordsprout-prod (BYOF)
│   System-Assigned MI: enabled
│
├── plan-wordsprout-prod            Microsoft.Web/serverfarms
│   Kind: functionapp (Flex Consumption)
│   SKU: FlexConsumption
│
├── func-wordsprout-prod            Microsoft.Web/sites (kind=functionapp,linux)
│   Runtime: node 20
│   Functions version: ~4
│   Plan: plan-wordsprout-prod
│   System-Assigned MI: enabled
│   App Settings: (same structure as DEV, prod values)
│     APP_ENV                  = prod
│     AI_QUOTA_LIMIT           = 20
│
├── stwordsproutprod                Microsoft.Storage/storageAccounts
│   Kind: StorageV2, SKU: Standard_LRS
│
├── cosmos-wordsprout-prod          Microsoft.DocumentDB/databaseAccounts
│   API: Core/NoSQL, Serverless
│   Soft-delete: 30 days
│   Resources: same as DEV
│
├── kv-wordsprt-prod                Microsoft.KeyVault/vaults
│   SKU: Standard, RBAC mode
│   Soft-delete: 90 days
│   Purge protection: enabled (prod)
│   Role assignments:
│   └── func-wordsprout-prod (MI) → Key Vault Secrets User
│
└── oai-wordsprout-prod             Microsoft.CognitiveServices/accounts
    Kind: OpenAI, SKU: S0
    Model deployments:
    └── gpt-4o-mini (GlobalStandard, capacity: 10 TPM)
```

---

### Shared Resources (Outside Resource Groups)

```
Azure AD B2C Tenant (manual creation)
├── Tenant name:  <wordsprout-b2c-tenant>.onmicrosoft.com
├── User flows:
│   └── B2C_1_susi  (Sign up and sign in)
│       Claims: email, given name, surname, sub
│
├── App Registration: wordsprout-dev
│   Client ID: <dev-client-id>
│   Redirect URIs: https://swa-wordsprout-dev.azurestaticapps.net
│   API scope: api/user  (exposed + granted to app)
│
└── App Registration: wordsprout-prod
    Client ID: <prod-client-id>
    Redirect URIs: https://<prod-domain>
    API scope: api/user  (exposed + granted to app)

GitHub Repository
├── Actions Variables (non-secret):
│   AZURE_CLIENT_ID           App Registration client ID (OIDC, PROD deploy)
│   AZURE_TENANT_ID           Azure AD tenant ID
│   AZURE_SUBSCRIPTION_ID     Azure subscription ID
│   PROD_VITE_B2C_TENANT      B2C tenant name
│   PROD_VITE_B2C_POLICY      B2C policy name (B2C_1_susi)
│   PROD_VITE_B2C_CLIENT_ID   B2C app client ID (prod registration)
│   PROD_VITE_REDIRECT_URI    PROD redirect URI
│   PROD_SWA_NAME             swa-wordsprout-prod
│   PROD_FUNC_APP_NAME        func-wordsprout-prod
│   PROD_RESOURCE_GROUP       rg-wordsprout-prod
│
└── No GitHub Secrets required (OIDC + runtime KV fetch)
```

---

## Bicep Module Hierarchy

```
infra/
├── main.bicep                      Root orchestration
│   Parameters:
│   ├── env: 'dev' | 'prod'
│   ├── location: string (default: resourceGroup().location)
│   ├── b2cTenant: string
│   ├── b2cPolicy: string
│   ├── b2cClientId: string
│   ├── aiQuotaLimit: int (default: 20)
│   └── aiModelCapacity: int (default: 10)
│
├── modules/
│   ├── storage.bicep               Storage account for Flex Consumption
│   │   Outputs: storageConnectionString, storageAccountName
│   │
│   ├── cosmos.bicep                Cosmos DB account + database + container
│   │   Outputs: cosmosEndpoint, cosmosKey
│   │
│   ├── openai.bicep                Azure OpenAI account + gpt-4o-mini deployment
│   │   Outputs: openaiEndpoint, openaiKey
│   │
│   ├── keyvault.bicep              Key Vault + secrets + RBAC role assignments
│   │   Inputs: cosmosKey, openaiKey, funcAppPrincipalId
│   │   Outputs: cosmosKeySecretUri, openaiKeySecretUri
│   │
│   ├── funcapp.bicep               App Service Plan (Flex) + Function App + app settings
│   │   Inputs: storageConnStr, cosmosEndpoint, cosmosKvRef, openaiEndpoint,
│   │           openaiKvRef, b2cTenant, b2cPolicy, b2cClientId, aiQuotaLimit, env
│   │   Outputs: funcAppId, funcAppPrincipalId, funcAppName
│   │
│   └── swa.bicep                   Static Web App + backend link to Function App
│       Inputs: funcAppId, env
│       Outputs: swaName, swaDefaultHostname
│
└── parameters/
    ├── dev.bicepparam              dev-specific overrides
    └── prod.bicepparam             prod-specific overrides
```

---

## GitHub Actions Workflow Structure

```
.github/workflows/
├── ci.yml                          PR validation
│   Triggers: pull_request → master
│   Jobs:
│   └── validate
│       Steps:
│       ├── checkout
│       ├── setup-node (20.x)
│       ├── install frontend deps
│       ├── frontend: lint + typecheck + test
│       ├── install api deps
│       └── api: lint + typecheck + test
│
└── cd-prod.yml                     PROD deployment
    Triggers: push → master
    Jobs:
    ├── build
    │   Steps:
    │   ├── checkout
    │   ├── setup-node (20.x)
    │   ├── install & build frontend (--mode prod)
    │   ├── install & build api
    │   └── upload artefacts: dist/, api-build/
    │
    └── deploy (needs: build)
        Permissions: id-token: write, contents: read
        Steps:
        ├── download artefacts
        ├── azure/login@v2 (OIDC — client-id, tenant-id, subscription-id from vars)
        ├── az staticwebapp secrets list → capture SWA deployment token
        ├── azure/static-web-apps-deploy@v1 (frontend)
        └── az functionapp deployment source config-zip (API)
```

---

## Deployment Script Structure

```
scripts/
└── deploy-dev.ps1
    Parameters:
    ├── -Location string    (default: denmarkeast)
    ├── -B2cTenant string   (required)
    ├── -B2cClientId string (required)
    ├── -SkipInfra switch   (skip Bicep, only deploy app code)
    └── -SkipApp switch     (only deploy infra, skip app code)

    Steps:
    1. Validate prerequisites (az, bicep, func, npm, node)
    2. Validate az login (check current account)
    3. Create resource group rg-wordsprout-dev (idempotent)
    4. az deployment group create --template-file infra/main.bicep
                                   --parameters infra/parameters/dev.bicepparam
                                               b2cTenant=$B2cTenant
                                               b2cClientId=$B2cClientId
    5. Build frontend: npm run build --mode dev  (in frontend/)
    6. Deploy frontend: az staticwebapp deploy
    7. Build API: npm run build  (in api/)
    8. Deploy API: func azure functionapp publish func-wordsprout-dev
    9. Print DEV URL and verify deployment
```

---

## Configuration State Transitions

| Config item | `local` (current) | `dev` (post-feature) | `prod` (post-feature) |
|---|---|---|---|
| `APP_ENV` | `local` | `dev` | `prod` |
| Auth | Bypassed (hardcoded identity) | Real B2C JWT validation | Real B2C JWT validation |
| Cosmos DB | In-memory mock | Real Cosmos DB (key via KV ref) | Real Cosmos DB (key via KV ref) |
| AI enrichment | Stub response | Real Azure OpenAI call | Real Azure OpenAI call |
| Allow-listing | Never checked | Cosmos DB point-read | Cosmos DB point-read |
| `COSMOS_KEY` source | N/A (mock) | Key Vault secret ref | Key Vault secret ref |
| `AZURE_AI_KEY` source | N/A (stub) | Key Vault secret ref | Key Vault secret ref |
| `AI_QUOTA_LIMIT` | `20` | `10` (lower for dev) | `20` |
| Frontend API base | `http://localhost:7071/api` | `/api` | `/api` |
