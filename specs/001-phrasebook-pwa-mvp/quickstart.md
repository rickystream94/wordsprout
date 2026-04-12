# Quickstart: VocaBook MVP — Developer Setup

**Branch**: `001-phrasebook-pwa-mvp`
**Last updated**: 2026-04-12

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS | Frontend + Azure Functions runtime |
| npm | 10+ | Bundled with Node 20 |
| Azure Functions Core Tools | v4 | `npm install -g azure-functions-core-tools@4` |
| Azure CLI | latest | For resource provisioning |
| Azure Static Web Apps CLI | latest | `npm install -g @azure/static-web-apps-cli` |

---

## Repository Structure

```
vocabook/
├── frontend/               # React PWA
│   ├── public/
│   │   └── languages.json  # Bundled ISO 639-1 language list
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route-level views
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/
│   │   │   ├── db.ts       # Dexie.js IndexedDB client
│   │   │   ├── sync.ts     # Pending-queue sync logic
│   │   │   ├── search.ts   # MiniSearch index + query
│   │   │   └── api.ts      # Typed HTTP client for /api/*
│   │   ├── store/          # React context / state
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── api/                    # Azure Functions (Node.js v4)
│   ├── src/
│   │   ├── functions/      # One file per HTTP trigger
│   │   ├── middleware/
│   │   │   └── authorise.ts  # JWT + allow-list enforcement
│   │   ├── services/
│   │   │   ├── cosmos.ts   # Cosmos DB client + helpers
│   │   │   └── ai.ts       # Azure AI Foundry proxy
│   │   └── models/         # Shared TypeScript types/interfaces
│   ├── package.json
│   └── host.json
│
├── staticwebapp.config.json  # SWA routing rules (proxy /api/* → functions)
├── .specify/
├── specs/
└── project-overview.md
```

---

## Environment Stages

VocaBook supports three distinct stages. Each has its own configuration; they never share
config files.

| Stage | Where runs | External services | Auth | Use for |
|---|---|---|---|---|
| **local** | Fully local | All mocked (no Azure needed) | Bypassed (hardcoded test user) | Core logic, UI, offline behaviour |
| **dev** | Local app + Azure dev resources | Real Cosmos DB (dev), Real B2C (dev), Real AI Foundry (dev) | Real OAuth | Integration testing with real data |
| **prod** | Fully on Azure | Real Azure production resources | Real OAuth | Production |

---

## Stage: `local` — Fully Local (No Azure Required)

All external services are replaced by in-process mocks. No Azure account, credentials,
or internet connection required. Auth is bypassed; the API treats every request as a
hardcoded test user (`test-user-local`). Ideal for day-to-day feature development.

### 1. Install dependencies

```bash
cd frontend && npm install
cd ../api && npm install
```

### 2. Configure

**api/local.settings.json** (not committed):
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "APP_ENV": "local",
    "AI_QUOTA_DAILY_LIMIT": "100"
  }
}
```

**frontend/.env.local** (not committed):
```
VITE_APP_ENV=local
VITE_API_BASE_URL=http://localhost:7071/api
```

When `APP_ENV=local`:
- The `authorise()` middleware is bypassed; all requests run as `test-user-local`.
- Cosmos DB is replaced by an in-memory store (e.g., a simple Map-based adapter).
- Azure AI Foundry is replaced by a stub that returns fixed sample enrichment data.
- The allow-list check always returns approved.

### 3. Start

```bash
# Terminal 1
cd api && npm run start:local

# Terminal 2
cd frontend && npm run dev
```

---

## Stage: `dev` — Local App, Real Azure Dev Resources

Frontend and API run locally but connect to dedicated Azure dev-tier resources.
Requires an Azure account and the one-time Azure setup below.

### 1. Configure

**api/local.settings.json** (not committed):
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "APP_ENV": "dev",
    "COSMOS_ENDPOINT": "<dev-cosmos-endpoint>",
    "COSMOS_KEY": "<dev-cosmos-key>",
    "COSMOS_DATABASE": "vocabook-dev",
    "COSMOS_CONTAINER": "data",
    "B2C_TENANT": "<your-tenant>.onmicrosoft.com",
    "B2C_POLICY": "B2C_1_signupsignin",
    "B2C_CLIENT_ID": "<dev-app-client-id>",
    "AI_FOUNDRY_ENDPOINT": "<dev-foundry-endpoint>",
    "AI_FOUNDRY_KEY": "<dev-foundry-key>",
    "AI_FOUNDRY_DEPLOYMENT": "gpt-4o-mini",
    "AI_QUOTA_DAILY_LIMIT": "10"
  }
}
```

**frontend/.env.dev** (not committed):
```
VITE_APP_ENV=dev
VITE_API_BASE_URL=http://localhost:7071/api
VITE_B2C_TENANT=<your-tenant>.onmicrosoft.com
VITE_B2C_CLIENT_ID=<dev-app-client-id>
VITE_B2C_POLICY=B2C_1_signupsignin
```

### 2. Start

Using Azure Static Web Apps CLI (recommended — handles B2C auth redirect and /api proxy):

```bash
# Terminal 1
cd api && npm run start

# Terminal 2
cd frontend && npx swa start http://localhost:5173 --api-location http://localhost:7071
```

---

## Stage: `prod` — Fully Cloud-Hosted

All services deployed to Azure. Configuration is managed via Azure Function App Settings
and Static Web Apps environment variables — never in source control.

See the Azure Setup sections below for one-time provisioning.

---

---

## Running Tests

```bash
# Frontend unit tests
cd frontend && npm test

# API unit tests
cd api && npm test

# API integration tests (requires local Cosmos emulator or test Cosmos account)
cd api && npm run test:integration
```

---

## Azure Resources Required

| Resource | SKU / Tier | Notes |
|---|---|---|
| Azure Static Web Apps | Free | Hosts frontend + proxies /api |
| Azure Functions | Consumption (Serverless) | Node.js 20 |
| Azure Cosmos DB | Serverless | Core (NoSQL) API |
| Azure AD B2C | Free (≤50k MAU) | Google + Microsoft providers |
| Azure AI Foundry | Pay-as-you-go | GPT-4o-mini deployment |

---

## Azure AD B2C Setup (one-time)

1. Create a B2C tenant in the Azure portal.
2. Register an application (SPA type) with redirect URI: `http://localhost:4280/auth-callback` (local) and `https://<your-swa>.azurestaticapps.net/auth-callback` (production).
3. Create a User Flow: **Sign up and sign in** (`B2C_1_signupsignin`), add Google and/or Microsoft identity providers.
4. Copy the Client ID and Tenant into environment variables.

---

## Cosmos DB Setup (one-time)

```bash
# Create database and container
az cosmosdb sql database create \
  --account-name <account> --resource-group <rg> \
  --name vocabook

az cosmosdb sql container create \
  --account-name <account> --resource-group <rg> \
  --database-name vocabook \
  --name data \
  --partition-key-path /userId \
  --throughput 0   # 0 = serverless
```

Seed the allow-list by inserting a document directly:
```json
{
  "id": "<oauth-sub>",
  "userId": "<oauth-sub>",
  "type": "allowlist",
  "email": "owner@example.com",
  "approvedAt": "2026-04-12T00:00:00Z",
  "createdAt": "2026-04-12T00:00:00Z"
}
```

---

## Security Checklist (before any deployment)

- [ ] `local.settings.json` is in `.gitignore` — never committed.
- [ ] `frontend/.env.local` is in `.gitignore` — never committed.
- [ ] All API keys set as Azure Function App Settings (not in source).
- [ ] `authorise()` middleware is called at the top of every authenticated function.
- [ ] Input sanitisation with DOMPurify / isomorphic-dompurify applied before storage.
- [ ] AI responses treated as untrusted and sanitised before storage.
- [ ] TLS enforced by Azure Static Web Apps (HTTPS-only by default).
- [ ] Rate limiting configured on all endpoints.
- [ ] Secret scanning enabled in CI pipeline.
