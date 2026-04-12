# Feature Specification: VocaBook — Personal Vocabulary Phrasebook (MVP)

**Feature Branch**: `001-phrasebook-pwa-mvp`
**Created**: 2026-04-12
**Status**: Draft
**Input**: Full product definition — offline-first vocabulary phrasebook PWA for independent foreign language learners

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Capture a Vocabulary Entry (Priority: P1)

A language learner encounters an unfamiliar word or expression — while reading, listening, or
in conversation. They open VocaBook, create a new entry in the relevant phrasebook, enter
the original expression and its translation, and optionally add notes. The entry is saved
immediately and is accessible even when the device has no internet connection.

**Why this priority**: This is the atomic unit of value for the product. Without the ability
to capture and persist a vocabulary entry reliably — especially offline — nothing else in
the app has meaning. Every other story depends on entries existing.

**Independent Test**: A user can open the app (with network disabled), create a phrasebook,
add a vocabulary entry with source text, target text, and a note, and immediately see the
entry listed in the phrasebook — all without any network activity.

**Acceptance Scenarios**:

1. **Given** the user has no internet connection and the app is installed, **When** they create
   a new phrasebook and add a vocabulary entry with source text, target text, and a note,
   **Then** the entry appears in the phrasebook immediately and persists after the app is closed
   and re-opened.
2. **Given** the user has an existing phrasebook, **When** they add a new entry with only
   source text and target text (no note), **Then** the entry is saved with a creation date and
   a default learning state of "new".
3. **Given** the user is online and adds an entry, **When** connectivity is lost mid-session,
   **Then** previously saved entries remain accessible and new entries can still be created.
4. **Given** the user has an entry, **When** they edit the source text, target text, or notes,
   **Then** the changes are saved and the previous version is not retained.

---

### User Story 2 — Search and Browse Vocabulary (Priority: P2)

A learner wants to find entries they have previously saved. They type into a search bar and
see matching results instantly, filtered across source text, target text, notes, and tags.
They can also narrow results by phrasebook, part-of-speech, tag, or learning status. The
entire experience works offline.

**Why this priority**: Search is the mechanism through which users retrieve and revisit their
vocabulary. It transforms a list of entries into a usable reference. Without searchability,
the phrasebook degrades to a sequential log.

**Independent Test**: With network disabled, a user with at least 20 entries can type a
substring and immediately see only entries whose source text, target text, notes, or tags
contain that substring. Applying a tag filter further narrows the results correctly.

**Acceptance Scenarios**:

1. **Given** the user has 20+ entries across multiple phrasebooks, **When** they type a word
   fragment into the search field, **Then** all entries containing that fragment in any text
   field (source, target, notes, tags) are returned within 1 second, without a network call.
2. **Given** search results are displayed, **When** the user applies a tag filter, **Then**
   only entries matching both the search term and the selected tag remain visible.
3. **Given** the search field is empty and no filters are active, **When** the user views a
   phrasebook, **Then** all entries appear in reverse-chronological order (most recent first).
4. **Given** the user applies a part-of-speech filter, **When** entries are displayed,
   **Then** only entries classified with that part of speech are shown, including those
   classified manually or via AI enrichment.
5. **Given** a search returns no matches, **When** the empty state is displayed, **Then** the
   app communicates clearly that no results were found and suggests clearing filters.

---

### User Story 3 — Sign Up and Access the App (Invite-Only) (Priority: P3)

A prospective user requests access to VocaBook through the app's access-request mechanism.
Once approved and added to the allow-list, they return to the app, sign in with their chosen
OAuth provider (Google or Microsoft), and land in their personal phrasebook workspace. Users
not on the allow-list are blocked from completing account creation.

**Why this priority**: Authentication and allow-list enforcement are prerequisite to any
user-facing functionality in the deployed app. However, core entry and search behaviour
(Stories 1–2) can be developed and tested offline-locally without an authentication layer.

**Independent Test**: An allow-listed user can sign in via OAuth and land in their workspace.
A non-allow-listed account attempting OAuth is blocked at the server with an appropriate
message before any personal data is created or exposed.

**Acceptance Scenarios**:

1. **Given** a user is on the allow-list, **When** they sign in via Google or Microsoft OAuth,
   **Then** they are authenticated and land in their personal phrasebook workspace with no
   personally identifiable data from other users visible.
2. **Given** a user is NOT on the allow-list, **When** they attempt to complete OAuth sign-in,
   **Then** the server rejects the request, no account is created, and the user sees a clear
   "access not yet granted" message.
3. **Given** an authenticated user's session expires, **When** they re-open the app,
   **Then** their locally cached data remains accessible, and they are prompted to re-authenticate
   when attempting any server-side operation.
4. **Given** a prospective user requests access, **When** their email is submitted,
   **Then** the system records the request and displays a confirmation that their request
   is pending review.

---

### User Story 4 — Organise Entries with Tags and Part-of-Speech (Priority: P4)

A learner wants to categorise their vocabulary by topic, source, difficulty, or any dimension
that makes sense to them. They assign free-form tags to entries. They can also request the
app to suggest a part-of-speech classification for an entry. The suggestion is editable.

**Why this priority**: Categorisation makes the phrasebook navigable and meaningful at scale.
Tags and part-of-speech classification drive the filter experience (Story 2). This story
extends entries rather than replacing them, so it can be layered on after basic entry
creation works.

**Independent Test**: A user can add tags to an existing entry, remove them, and search by
tag. They can also request a part-of-speech suggestion for an entry and then change it to a
different value — and the modified value persists.

**Acceptance Scenarios**:

1. **Given** an existing vocabulary entry, **When** the user adds one or more free-form tags,
   **Then** the tags are saved with the entry and appear in tag-based filters.
2. **Given** an existing entry, **When** the user removes a tag, **Then** the tag no longer
   appears on the entry and the entry no longer appears in filters for that tag.
3. **Given** the user requests a part-of-speech classification for an entry,
   **When** the classification is returned (whether via AI or manually entered), **Then** it
   is stored on the entry and immediately usable as a filter criterion.
4. **Given** a user sets a part-of-speech classification to "verb", **When** they later change
   it to "idiom", **Then** the new value is saved and the old value is no longer associated.
5. **Given** a tag has been used on multiple entries, **When** the user views the tag list,
   **Then** the tag appears once in the list regardless of how many entries use it.

---

### User Story 5 — Request AI Enrichment for an Entry (Priority: P5)

A learner wants to deepen their understanding of a word or expression they have saved. From
the entry detail view, they trigger an AI enrichment request. The app returns contextual
material (example sentences, synonyms, register label, collocations, or false-friend
warnings) as a set of editable suggestions. The learner can accept, edit, or discard any
suggestion.

**Why this priority**: AI enrichment adds significant learning value but is not required to
capture, search, or organise vocabulary. It is explicitly opt-in and depends on network
connectivity. It is prioritised below the core offline-capable flows.

**Independent Test**: With network available, a user triggers AI enrichment on a single
entry and receives at least one type of enrichment material. They edit the suggestion and
the edited value persists on the entry.

**Acceptance Scenarios**:

1. **Given** the user views a vocabulary entry and is online, **When** they trigger AI
   enrichment, **Then** the app returns at least one category of enrichment content (example
   sentences, synonyms, register, collocations, or false-friend warnings) within 10 seconds.
2. **Given** AI enrichment content is displayed, **When** the user edits a suggestion,
   **Then** the edited value is saved and the AI-generated original is not preserved over
   the user's edit.
3. **Given** AI enrichment has been triggered once for an entry, **When** the user is offline
   and views the entry, **Then** the previously fetched enrichment content is still visible.
4. **Given** the user is offline, **When** they attempt to trigger AI enrichment,
   **Then** the option is disabled or a clear explanation is shown; no silent failure occurs.
5. **Given** the daily AI usage limit has been reached, **When** a user attempts to trigger
   enrichment, **Then** they receive a clear message indicating that AI enrichment is
   unavailable until the next day.

---

### User Story 6 — Track and Review Learning Progress (Priority: P6)

A learner wants to track which words they are actively learning and which they have mastered.
They can change the learning state of any entry (new → learning → mastered). They can start
a manual review session that surfaces entries in a learning state, prompting recall.

**Why this priority**: Progress tracking and review are valuable but not blocking. States
enrich the entry model and feed filters. A manual review session is the simplest retention
mechanism and is sufficient for the MVP.

**Independent Test**: A user can mark 5 entries as "learning", start a manual review session
limited to learning-state entries, step through each entry, and toggle their state to
"mastered". All state changes persist after the session ends.

**Acceptance Scenarios**:

1. **Given** an entry in "new" state, **When** the user marks it as "learning",
   **Then** the state is updated and the entry appears in the learning-state filter.
2. **Given** the user starts a review session, **When** they choose to filter by
   "learning" state, **Then** only entries in that state are presented in the session.
3. **Given** a review session is in progress, **When** the user advances to the next entry,
   **Then** the current entry's state can be updated before advancing.
4. **Given** the user closes the app mid-session, **When** they re-open the app,
   **Then** all state changes made before closing have been persisted.

---

### Edge Cases

- What happens if the user attempts to add an entry with only source text and no target text?
  (Assumed: entry is saved; target text is optional but strongly encouraged via UI hint.)
- What happens when a phrasebook is deleted — are its entries also permanently deleted?
  (Assumed: entries within the phrasebook are deleted; this action must be confirmed.)
- What happens if two devices add entries for the same user while both are offline?
  (Assumed: last-write-wins on sync; no conflict resolution in MVP.)
- What happens if an AI enrichment request times out?
  (Assumed: the user sees a clear error and can retry; no partial results are saved.)
- What happens if a user attempts to import entries from an external file?
  (Out of scope for MVP.)
- What happens when the allow-list entry is revoked for an active user?
  (Assumed: the next authenticated request is rejected; the user is signed out.)

---

## Requirements *(mandatory)*

### Functional Requirements

**Phrasebook Management**

- **FR-001**: Users MUST be able to create one or more named phrasebooks.
- **FR-002**: Users MUST be able to rename and delete phrasebooks.
- **FR-003**: Each phrasebook MUST be independently browsable and searchable.

**Vocabulary Entry Management**

- **FR-004**: Users MUST be able to create a vocabulary entry with at minimum a source
  expression and a target-language expression.
- **FR-005**: Entries MUST support an optional free-text notes field.
- **FR-006**: Entries MUST record the date they were created.
- **FR-007**: Users MUST be able to edit all fields of any entry at any time.
- **FR-008**: Users MUST be able to delete any entry, with confirmation required.
- **FR-009**: Entries MUST have a learning state with values: new, learning, mastered.
  Default is "new".

**Offline Operation**

- **FR-010**: All entry creation, editing, deletion, browsing, and search MUST work
  without an internet connection.
- **FR-011**: Data created offline MUST be synchronised to the server-side store when
  connectivity is next available, without user intervention.
- **FR-012**: The app MUST indicate clearly to the user when it is operating in offline mode.

**Tagging & Classification**

- **FR-013**: Users MUST be able to assign zero or more free-form tags to any entry.
- **FR-014**: Tags MUST be reusable across entries and presented as a selectable list
  within the current user's scope.
- **FR-015**: Users MUST be able to assign a part-of-speech classification to any entry
  from the set: noun, verb, adjective, adverb, idiom/expression, phrasal verb, other.
- **FR-016**: Part-of-speech classification MUST be manually editable regardless of how
  it was originally set.

**Search & Filtering**

- **FR-017**: Users MUST be able to perform full-text search across source text, target
  text, notes, and tags simultaneously.
- **FR-018**: Search results MUST appear without perceptible delay (see SC-003).
- **FR-019**: Users MUST be able to filter entries by phrasebook, learning state, part of
  speech, and tag (combinable filters).
- **FR-020**: Filter and search state MUST be combinable; all active filters apply
  simultaneously.

**AI Enrichment**

- **FR-021**: Users MUST be able to request AI enrichment for any individual entry on
  demand; enrichment is never triggered automatically.
- **FR-022**: AI enrichment MUST provide at least one of: example sentences, synonyms,
  antonyms, register label, collocations, false-friend warnings.
- **FR-023**: All AI-generated content MUST be presented as editable suggestions; the
  user's edits MUST supersede the AI-generated value.
- **FR-024**: The system MUST enforce a daily per-user AI enrichment usage limit.
- **FR-025**: When the daily limit is reached, the AI enrichment action MUST be visibly
  disabled with an explanatory message; no silent failure is permitted.
- **FR-026**: AI enrichment MUST NOT be available when the device is offline; the control
  MUST reflect this state.

**Authentication & Access Control**

- **FR-027**: Users MUST authenticate via OAuth using Google or Microsoft as identity
  providers.
- **FR-028**: Only users explicitly added to the allow-list MUST be permitted to complete
  account creation and access any personal data.
- **FR-029**: Allow-list enforcement MUST be applied server-side on every authenticated
  request, not only at initial login.
- **FR-030**: Prospective users MUST be able to submit an access request through the app;
  the submission MUST be acknowledged with a confirmation message.
- **FR-031**: Users not on the allow-list who attempt OAuth sign-in MUST receive a clear
  "access not yet granted" message and MUST NOT have any personal data created or exposed.

### Key Entities

- **User**: An authenticated, allow-listed learner. Identified by their OAuth identity.
  Holds a collection of phrasebooks. Has daily AI usage quota state.

- **Phrasebook**: A named container owned by a user, typically representing one target
  language. Contains vocabulary entries. Has a name and creation date.

- **VocabularyEntry**: The core entity. Belongs to one phrasebook. Fields: source
  expression, target expression, notes (optional), tags (list), part-of-speech
  (optional), learning state, creation date, last-modified date.

- **Tag**: A user-scoped label string. Not a separate stored entity in the MVP — tags are
  free-form strings on entries, deduplicated at query time for the filter list.

- **AIEnrichment**: Content generated on-demand for a single VocabularyEntry. Attached to
  the entry. Fields: example sentences, synonyms, antonyms, register, collocations,
  false-friend warnings. All fields are independently editable by the user after generation.

- **AccessRequest**: A record of a prospective user's request to join. Fields: email,
  timestamp, status (pending / approved / rejected).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can open the app, create a phrasebook, and add a vocabulary entry
  within 60 seconds on first use — with no internet connection.
- **SC-002**: Entries captured while offline are synchronised to the cloud within 30 seconds
  of the device regaining connectivity with no user action required.
- **SC-003**: Full-text search across a library of up to 2,000 entries returns results
  within 1 second, with no network call.
- **SC-004**: A non-allowed user attempting to sign in is blocked entirely — no partial
  account creation, no personal data visible — within the standard OAuth redirect flow.
- **SC-005**: AI enrichment for a single entry is returned and displayed within 10 seconds
  of the user's request, when the device is online.
- **SC-006**: The daily AI usage limit prevents any further enrichment calls once the cap is
  reached; the limit resets within 24 hours.
- **SC-007**: Monthly infrastructure cost for the app remains below $100, with a target
  below $50, under anticipated private-preview traffic (up to 50 active users).
- **SC-008**: The app installs as a PWA and is fully usable from the home screen on both
  iOS and Android devices, including offline entry capture.

---

## Assumptions

- Users are adult, independent language learners with at least basic digital literacy.
  The app is not designed for children or classroom delivery.
- A single user may maintain multiple phrasebooks (one per target language is the typical
  case, but not imposed by the system).
- The allow-list is administered manually by the product owner via a backend tool or direct
  data store access; no self-service admin UI is required in the MVP.
- Conflict resolution for concurrent offline edits is last-write-wins; multi-device
  concurrent editing is not a supported use case in the MVP.
- Part-of-speech AI classification is a discrete, single-field suggestion per entry;
  it does not involve sentence decomposition or complex NLP.
- Spaced repetition is explicitly out of scope for the MVP; the review flow is fully manual.
- Social features, entry sharing, and public phrasebooks are explicitly out of scope.
- Data import/export (CSV, Anki, etc.) is out of scope for the MVP.
- The target language of a phrasebook is a user-chosen label only; the system does not
  validate or process it as a locale identifier.
- The app targets modern evergreen browsers on desktop and mobile; IE11 and legacy browsers
  are not supported.
