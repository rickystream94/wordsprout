# WordSprout — Grow Your Words

A personal, offline-first vocabulary notebook for language learners. Capture words you encounter in real life, organise them into phrasebooks, and grow them from dormant to engraved through adaptive flashcard review.

---

## Features

- **Phrasebooks** — one per language pair, as many as you need
- **Vocabulary entries** — source/target text, notes, tags, part-of-speech
- **AI enrichment** — on-demand definitions, pronunciation, and examples (opt-in, always editable)
- **Adaptive learning score** — 0–100 per entry, progressing through five stages: 🌑 Dormant · 🌱 Sprouting · 💬 Echoing · ✏️ Inscribed · 🧠 Engraved
- **Typed-translation review** — flashcard sessions with typo tolerance and hints
- **Full-text offline search** — across all entries and phrasebooks
- **Offline-first** — full read/write without connectivity; background sync via Service Worker

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 5, Vite, Dexie.js (IndexedDB), MSAL.js v3 |
| API | Azure Functions Node.js v4, TypeScript 5 |
| Database | Azure Cosmos DB (serverless, NoSQL API) |
| Auth | Microsoft Entra ID (MSAL) + Google OAuth — invite-only allowlist |
| Hosting | Azure Static Web Apps |

## Project structure

```
frontend/   React PWA (Vite + React 18)
api/        Azure Functions backend
specs/      Feature specifications and design documents
docs/       Project overview and architecture notes
```

## Getting started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 24 LTS |
| Azure Functions Core Tools | v4 (`npm install -g azure-functions-core-tools@4`) |

### Run locally

```powershell
.\dev.ps1
```

Starts the API on `:7071` and the Vite dev server on `:5173`. In `APP_ENV=local` mode, auth is bypassed and Cosmos DB runs in-memory — no Azure credentials required.

### Manual setup

```bash
# API
cd api && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

### Cloud-connected local run

Copy `api/local.settings.json.example` to `api/local.settings.json`. The deploy script can auto-populate it from `infra/config.json`:

```powershell
# Populate local.settings.json with real Azure credentials
.\scripts\deploy-dev.ps1 -SkipInfra
```

Authentication uses OIDC / Managed Identity — no storage keys or client secrets are required.

## License

MIT — see [LICENSE](LICENSE).
