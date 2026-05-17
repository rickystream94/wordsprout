# WordSprout Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-17

## Active Technologies
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (008-learning-score-decay)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (008-learning-score-decay)
- TypeScript 5.x + Dexie.js 4.x (IndexedDB), React 18, `dexie-react-hooks` (008-learning-score-decay)
- IndexedDB (Dexie) as primary client-side store; Azure Cosmos DB Serverless as sync target (008-learning-score-decay)

| Layer | Technologies |
|---|---|
| **Frontend** | TypeScript 5.x, React 18, Vite, react-router-dom, Dexie.js 4.x (IndexedDB), MSAL.js v3, MiniSearch, `fastest-levenshtein` |
| **API** | Azure Functions Node.js v4, TypeScript 5.x, `@azure/cosmos`, `jsonwebtoken`, `jwks-rsa`, `isomorphic-dompurify` |
| **Storage** | IndexedDB via Dexie.js (client-side primary); Azure Cosmos DB Serverless NoSQL (server-side sync target); Azure Storage (Flex Consumption) |
| **CI/CD & IaC** | PowerShell 7.x, Bicep ≥ 0.26, GitHub Actions, Azure CLI ≥ 2.60, Azure Functions Core Tools v4, `azure/login@v2`, `azure/static-web-apps-deploy@v1` |
| **Testing** | Vitest 3.x (API), Vitest 4.x (frontend), `@testing-library/react` 16.x, `@testing-library/user-event` 14.x, `@vitest/coverage-v8`, jsdom |

## Project Structure

```text
api/        Azure Functions backend (Node.js v4, TypeScript)
frontend/   React PWA (Vite, React 18, TypeScript)
infra/      Bicep IaC modules and parameters
scripts/    PowerShell deployment and seed scripts
specs/      Feature specifications and design documents
docs/       Project overview and architecture notes
```

## Commands

```powershell
# Run everything locally (API on :7071, frontend on :5173)
.\dev.ps1

# API — install, dev server, tests
cd api && npm install
cd api && npm run dev
cd api && npm run test:coverage

# Frontend — install, dev server, tests
cd frontend && npm install
cd frontend && npm run dev
cd frontend && npm run test:coverage

# Type-check (run from the relevant package root)
cd api && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

## Code Style

TypeScript 5.x: strict mode, no implicit any. React: functional components with hooks only; no class components. Styling: CSS Modules (`.module.css`) co-located with components. Imports: absolute paths via `tsconfig` path aliases where configured.

## Recent Changes
- 008-learning-score-decay: Added TypeScript 5.x + Dexie.js 4.x (IndexedDB), React 18, `dexie-react-hooks`
- 008-learning-score-decay: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]
- feature/007-unit-testing-coverage: Added Vitest test infrastructure for API and frontend with coverage thresholds


<!-- MANUAL ADDITIONS START -->
## Workflow Rules

- **Always use PowerShell (`pwsh`) when running terminal commands or scripts.** Never use bash or sh. All scripts in this project are `.ps1` files.

- **Always run `npx tsc --noEmit` after editing any `.ts` or `.tsx` file**, before committing. Run from the package root that owns the `tsconfig.json` (e.g. `frontend/` or `api/`). Fix all type errors before proceeding.

- **Unit tests are mandatory for all new and changed business logic.** Every new API function handler, middleware, service, or utility in `api/src/` must have a corresponding `__tests__/` file. Every new frontend hook, service function, or UI component with logic must have a `__tests__/` file. Co-locate tests next to the module (e.g., `services/__tests__/myService.test.ts`). Always run `npm run test:coverage` in the relevant package before marking a task complete — coverage thresholds must not regress.
<!-- MANUAL ADDITIONS END -->
