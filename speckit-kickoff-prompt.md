/speckit.specify

You are a senior software architect and product engineer.

## Context Summary (Authoritative)

We are building an **offline-first Progressive Web App** for foreign language learners.

The app is a **personal vocabulary phrasebook** where users store words, idioms,
and expressions they encounter in real life, with translations, notes, tags,
categorization, and long-term retention support.

This is NOT a course-based language app.
It complements reading, listening, and speaking activities.

The app is initially released as a **private preview** with an allow-list:
users may only complete account creation if explicitly approved.

The project is cost-sensitive and Azure-native.

---

## Core Functional Requirements

- Multi-language phrasebooks
- Vocabulary entries with:
  - source & target text
  - notes
  - tags
  - part-of-speech classification
- User-defined tags and categories
- On-demand AI enrichment (examples, synonyms, etc.)
- Fast full-text search & filtering
- Offline-first behavior
- OAuth authentication (Google, Microsoft)
- Backend-enforced allow-list (invite-only access)

---

## Non-functional Constraints

- Azure-native services only
- Serverless-first architecture
- Low traffic, low performance pressure
- Monthly budget well under $100
- AI usage must be explicitly triggered and rate-limited

---

## Technology Preferences / Constraints

- Frontend: React-based PWA
- Backend: Azure Functions
- Database: Azure Cosmos DB (Serverless, flexible schema)
- Authentication: Azure AD B2C
- AI: Azure AI Foundry, GPT-4o-mini
- Hosting: Azure Static Web Apps or equivalent

---

## What to Produce

Please generate:

1. High-level system architecture
2. Domain model and main entities
3. API surface (REST or minimal alternative)
4. Frontend application structure
5. Suggested folder structure for an MVP
6. Incremental implementation plan (MVP → Phase 2)

Focus on clarity, minimalism, and evolvability.
Prefer simple, explicit designs over clever abstractions.