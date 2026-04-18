# WordSprout Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-18

## Active Technologies
- TypeScript 5.x (frontend + API) + React 18, Vite, Dexie.js, MiniSearch, MSAL.js v3; Azure Functions Node.js v4, @azure/cosmos, jsonwebtoken, jwks-rsa, isomorphic-dompurify (001-phrasebook-pwa-mvp)
- IndexedDB via Dexie.js (client-side); Azure Cosmos DB Serverless Core/NoSQL API (server-side) (001-phrasebook-pwa-mvp)
- TypeScript 5.x (frontend + API) + React 18, Vite, Dexie.js 4.x, MSAL.js v3, react-router-dom (frontend); Azure Functions Node.js v4, @azure/cosmos, isomorphic-dompurify (API); `fastest-levenshtein` (new, frontend scoring) (002-adaptive-learning-state)
- IndexedDB (Dexie.js) — client-side primary store; Azure Cosmos DB Serverless NoSQL — server-side sync target (002-adaptive-learning-state)
- TypeScript 5.x (existing app code, unchanged); PowerShell 7.x (deploy scripts); Bicep ≥ 0.26 (IaC); GitHub Actions YAML (CI/CD) + Azure CLI ≥ 2.60, Azure Functions Core Tools v4, Bicep CLI (via `az bicep`), `azure/login@v2`, `azure/static-web-apps-deploy@v1` (GitHub Actions) (003-cicd-azure-infra-deploy)
- Azure Cosmos DB Serverless Core/NoSQL (existing contract, unchanged); Azure Storage (Flex Consumption requirement) (003-cicd-azure-infra-deploy)

- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (001-phrasebook-pwa-mvp)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

cd src; pytest; ruff check .

## Code Style

[e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]: Follow standard conventions

## Recent Changes
- 003-cicd-azure-infra-deploy: Added TypeScript 5.x (existing app code, unchanged); PowerShell 7.x (deploy scripts); Bicep ≥ 0.26 (IaC); GitHub Actions YAML (CI/CD) + Azure CLI ≥ 2.60, Azure Functions Core Tools v4, Bicep CLI (via `az bicep`), `azure/login@v2`, `azure/static-web-apps-deploy@v1` (GitHub Actions)
- 002-adaptive-learning-state: Added TypeScript 5.x (frontend + API) + React 18, Vite, Dexie.js 4.x, MSAL.js v3, react-router-dom (frontend); Azure Functions Node.js v4, @azure/cosmos, isomorphic-dompurify (API); `fastest-levenshtein` (new, frontend scoring)
- 001-phrasebook-pwa-mvp: Added TypeScript 5.x (frontend + API) + React 18, Vite, Dexie.js, MiniSearch, MSAL.js v3; Azure Functions Node.js v4, @azure/cosmos, jsonwebtoken, jwks-rsa, isomorphic-dompurify


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
