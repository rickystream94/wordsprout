<!--
## Sync Impact Report

**Version Change**: none (initial) → 1.0.0

**Modified Principles**: N/A — initial creation

**Added Sections**:
- Core Principles (5): Encounter-First Learning, Learner Ownership & Context Richness,
  Offline-First Architecture, AI as Assistant Never Director, Cost-Conscious & Minimal
- Technical Architecture Constraints
- Access Control & Private Preview
- Governance

**Removed Sections**: N/A — initial creation

**Templates Review**:
- `.specify/templates/plan-template.md` ✅ — Constitution Check placeholder is generic;
  populate per-feature with offline-first and cost gates
- `.specify/templates/spec-template.md` ✅ — User story and functional requirement structure
  supports PWA/offline scenarios with no changes needed
- `.specify/templates/tasks-template.md` ✅ — Phase structure supports web-app delivery
  patterns; offline-first and cost-conscious task categorisation applies naturally

**Deferred Items**: None
-->

# VocaBook Constitution

## Core Principles

### I. Encounter-First Learning

Words and phrases are added to VocaBook because the user encountered them in real life —
not because the app assigned, suggested, or required them. This is the foundational
contract with the learner.

- The app MUST NOT impose vocabulary lists, curricula, or mandatory word sets.
- Every entry is user-initiated; AI enrichment MUST only act on entries the user already created.
- Features that invert this model (e.g., "word of the day" push, auto-generated lists) are
  explicitly out of scope and MUST NOT be implemented.
- Spaced repetition and review flows MUST operate only on words the user has added.

**Rationale**: The core value proposition is that learners retain words encountered in real
context. Any shift away from encounter-first degrades trust and erodes the distinction
between VocaBook and generic curriculum apps.

### II. Learner Ownership & Context Richness

Notes, tags, context, and learning state are first-class citizens of every vocabulary entry.
The learner's annotations define the entry — not the application's data model.

- Users MUST be able to annotate, edit, and delete any field on any entry at any time.
- AI-generated content MUST never silently overwrite user-authored content; it MUST be
  presented as an editable proposal.
- Tags and categories are user-defined and free-form; the app MUST NOT restrict or
  canonicalize them without explicit user action.
- The data model and storage architecture MUST NOT prevent future portable export of all
  user data.

**Rationale**: Ownership and reflection distinguish a personal vocabulary book from a
generic flashcard tool. Data lock-in is antithetical to the product's identity.

### III. Offline-First Architecture (NON-NEGOTIABLE)

The app MUST remain fully functional without internet connectivity. Network access is
treated as an enhancement, never a prerequisite.

- All core features (add entry, search, browse, review) MUST work with no network access.
- IndexedDB MUST be the primary client-side data store.
- Background sync MUST only execute when the device is online and MUST never block or
  degrade the offline experience.
- The UI MUST communicate sync state clearly without interrupting the user workflow.

**Rationale**: Language encounters happen anywhere — on trains, in cafés, mid-conversation.
The app fails its core purpose if entries cannot be captured offline.

### IV. AI as Assistant, Never Director

AI enrichment is strictly opt-in and always user-triggered. The app MUST NOT invoke AI
automatically or on behalf of the user without an explicit per-request action.

- AI features (example sentences, synonyms, register, collocations, false-friend warnings)
  MUST be triggered explicitly per entry by the user.
- No background or automatic AI calls are permitted at any time.
- All AI usage MUST be rate-limited and subject to a configured daily cost cap.
- AI suggestions MUST be presented as editable proposals; they are never authoritative.
- AI MUST NOT be involved in authentication, access control, or any security-sensitive path.

**Rationale**: Unconstrained AI calls violate both the cost ceiling and user trust. AI is a
tool that amplifies the learner's own work — it does not replace it.

### V. Cost-Conscious & Minimal

Every architectural and feature decision MUST be evaluated against operating cost. Complexity
requires explicit justification relative to the budget constraint.

- Target operating cost: $20–50 USD/month; absolute ceiling: $100 USD/month.
- Serverless-first: Azure Functions and Cosmos DB Serverless MUST be the default compute and
  storage choice; stateful or always-on infrastructure requires justification.
- Any feature that would cause sustained spend above the ceiling MUST NOT ship without a
  documented cost mitigation plan.
- YAGNI applies: no speculative infrastructure, premature optimization, or unused services.
- AI model selection MUST use the most cost-effective model meeting quality requirements
  (currently GPT-4o-mini via Azure AI Foundry).

**Rationale**: VocaBook is a personal-scale product. Architectural discipline is the
mechanism that keeps it financially sustainable without external funding.

## Technical Architecture Constraints

The following stack is mandated for the initial release. Deviations require a formal
constitution amendment.

- **Frontend**: Progressive Web App (PWA) using React; offline-first via IndexedDB;
  background sync when online.
- **Backend**: Azure Functions (serverless) for all server-side API and AI proxy logic.
- **Database**: Azure Cosmos DB (Serverless, Core/NoSQL API).
- **Hosting**: Azure Static Web Apps (or Azure Blob Static Website).
- **Authentication**: Azure AD B2C with OAuth providers (Google, Microsoft). Allow-list
  enforcement MUST be implemented server-side in Azure Functions.
- **AI**: Azure AI Foundry; GPT-4o-mini. All AI calls MUST be proxied through server-side
  Functions — client code MUST NOT hold AI service credentials or API keys.

**Security requirements**:

- Client-side code MUST NOT contain API keys, secrets, or AI service credentials.
- All authentication tokens MUST be validated server-side before any data access.
- Allow-list membership MUST be re-validated on each authenticated request, not only at login.
- Input from users and AI responses MUST be sanitised before storage or display.

## Access Control & Private Preview

The initial release is invite-only. This policy MUST be enforced at the infrastructure level,
not solely in the UI.

- Prospective users MUST request access before completing OAuth sign-up.
- Only allow-listed users may complete registration and access any authenticated endpoint.
- Allow-list status MUST be checked server-side (Azure Functions) on every authenticated call.
- This policy MUST remain in place until explicitly repealed through the governance process.

**Rationale**: Invite-only access controls cost, enables curated feedback, and prevents
uncontrolled growth during the private preview phase.

## Governance

This constitution supersedes all other practices, conventions, and README guidance. When
conflict exists, the constitution wins.

**Amendment procedure** (MUST be followed for all changes):

1. **Propose** the change with a written rationale identifying the affected principle or
   section and the reason for the change.
2. **Classify** the version bump:
   - MAJOR — principle removal, redefinition, or backward-incompatible governance change.
   - MINOR — new principle or section added, or material expansion of existing guidance.
   - PATCH — clarification, wording fix, or non-semantic refinement.
3. **Update** this file, increment the version, and set `Last Amended` to today (ISO format).
4. **Propagate** relevant changes to `.specify/templates/` and any active spec or plan
   documents in progress.
5. **Commit** with the message format:
   `docs: amend constitution to vX.Y.Z (<one-line summary>)`

**Compliance gates**:

- All feature plans MUST include a Constitution Check before Phase 0 research, verifying
  alignment with Principles III (offline-first) and V (cost-conscious) at minimum.
- All pull requests MUST verify compliance with active principles before merge.
- Principles III and V are non-negotiable: they MUST NOT be relaxed without a full
  architectural review and MAJOR version bump.

**Version**: 1.0.0 | **Ratified**: 2026-04-12 | **Last Amended**: 2026-04-12
