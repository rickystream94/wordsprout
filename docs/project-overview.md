# Project Overview – Personal Vocabulary Phrasebook PWA: WordSprout

## Vision

Build a modern, offline-first Progressive Web App for foreign language learners,
designed to capture, retain, and truly *own* vocabulary encountered in real life.

The app is a digital evolution of the traditional school “vocabulary notebook”
(“Quaderno dei vocaboli”), enhanced with search, categorization, review flows,
and optional AI assistance.

This is **not** a curriculum-based language learning app.
It complements reading, listening, and speaking by helping users remember
words they actually encountered.

---

## Target Audience

- Independent foreign language learners
- Advanced learners dealing with rare or domain-specific vocabulary
- Learners frustrated by repeatedly looking up the same words
- Users who want ownership over their learning data

---

## Core Principles

1. **Encounter-first learning**
   Words are added because the user met them in real life, not because the app assigned them.

2. **Ownership & reflection**
   Notes, tags, and context are first-class citizens.

3. **Offline-first**
   The app must remain fully usable without connectivity.

4. **AI as an assistant, not a replacement**
   AI enriches what the learner captures; it does not dictate content.

5. **Cost-conscious & minimal**
   Built to run comfortably under a small Azure budget.

---

## Key Features

### Phrasebooks
- Multiple phrasebooks per user
- Typically one per target language, but flexible by design
- Each phrasebook contains vocabulary entries

---

### Vocabulary Entries

Each entry may include:
- Source (native) expression
- Target language expression
- Optional notes and usage context
- Creation date
- **Learning score** (0–100) with 5 memory-inspired checkpoints: 🌑 Dormant · 🌱 Sprouting · 💬 Echoing · ✏️ Inscribed · 🧠 Engraved

---

### Categorization & Organization

#### Automatic (Optional)
- AI-assisted detection of **part of speech**:
  - noun
  - verb
  - adjective
  - adverb
  - idiom / expression
  - phrasal verb
  - other
- Triggered **only on user request** to control AI costs
- Always manually editable by the user

#### User-defined
- Free-form tags and categories
- Tags may represent:
  - topics (`travel`, `work`)
  - sources (`book-xyz`, `podcast`)
  - difficulty (`hard`, `always-forget`)
  - personal mnemonics
- Tags are language-agnostic and non-exclusive

---

### Search & Filtering

A core experience of the app.

- Instant full-text search across:
  - source text
  - target text
  - notes
  - tags
- Filters by:
  - language / phrasebook
  - part of speech
  - tag(s)
  - learning score checkpoint (Dormant / Sprouting / Echoing / Inscribed / Engraved)
- Works **offline**, powered by IndexedDB on the client
- Feels like browsing a personal notebook, not querying a database

---

### Review & Learning

- Typed-translation flashcard sessions, scoped to a phrasebook
- Gamified scoring: correct answers gain points, wrong / revealed answers deduct points
- Hints reveal characters one by one (small score penalty per hint used)
- Typo tolerance: close-but-not-exact answers accepted with a reduced gain
- Reveal button shows the answer immediately at the cost of a full wrong penalty
- Animated score-delta feedback after each card
- Daily review limit: score changes only once per entry per day
- Non-transactional: each card's score is persisted immediately (partial sessions are saved)
- Progress indicated by the 5-checkpoint learning score bar on every entry

---

### AI-Assisted Enrichment (Opt-in)

On-demand AI features per vocabulary entry:
- Example sentences
- Synonyms / antonyms
- Register detection (formal / informal)
- Collocations
- False-friend warnings (language-pair dependent)

AI usage is:
- Explicitly user-triggered
- Rate-limited
- Cost-capped per day

---

## Private Preview / Access Control

The initial release is **invite-only**.

- Users must request access first
- Only allow-listed users may complete OAuth signup
- Access is enforced server-side after authentication
- Allows:
  - cost control
  - curated feedback
  - gradual feature rollout

---

## Technical Architecture (High Level)

### Frontend
- Progressive Web App (PWA)
- React-based stack
- Offline-first using IndexedDB
- Background sync when online

### Backend (Azure)
- Azure Functions (serverless API)
- Azure Cosmos DB (Serverless, Core API)
- Azure Static Web Apps (or Blob Static Website)
- Azure AD B2C for OAuth (Google, Microsoft)
- Azure AI Foundry (GPT-4o-mini)

---

## Cost Target

- Intended to run under **$20–50 USD / month**
- Absolute ceiling: **$100 USD / month**

---

## Roadmap Snapshot

### MVP
- Phrasebooks & vocabulary entries
- Tags & part-of-speech
- Search & filtering
- Offline-first PWA
- OAuth + allow-list
- Manual review

### Phase 2
- Spaced repetition
- Richer AI enrichment
- Usage analytics
- Optional social sharing (read-only)

---

## Non-goals (Explicit)

- Full language courses
- Grammar instruction
- AI-first “chat-based learning”
- Public, uncontrolled user growth (initially)