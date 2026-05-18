# Feature Specification: Rehearse Review Mode

**Feature Branch**: `feature/009-rehearse-review-mode`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "I want to introduce a new type of Review mechanism. Right now, users can review phrasebook entries by doing 'competitive' flashcards, which would impact the learning score by either increasing or decreasing it based on the review outcome. Users should also be able to choose to do a Rehearse review type, where similarly to the current review type, they choose a target phrasebook and how long it should last (i.e. how many flashcards), but the point is not to submit a translation, but instead simply drill into the individual cards and all their metadata, including the enrichments, so they can start to familiarize with the vocabulary entries. This kind of review doesn't impact the learning score, it simply provides a way to rehearse in a less competitive manner. It should be clear to users however that such kind of review doesn't affect the learning score. It would be nice that, on mobile, users can use swiping gestures to move to the next flashcard. All the content of the flashcard should be presented in a nice, presentation-friendly, neat way, and strictly one flashcard at a time. Users can always interrupt the session at any point. No interaction with backend should be required for this kind of review. Users may also choose to narrow down the rehearsal to specific parts of speech only or specific tags, and whether they want to prioritize entries with low learning score or get a random sample."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Start a Rehearse Session (Priority: P1)

A language learner wants to familiarise themselves with a set of vocabulary entries without the pressure of being graded. They open a phrasebook, select the "Rehearse" review type, configure how many flashcards to include, and begin a guided walkthrough of cards showing the full entry — expression, translation, notes, part of speech, tags, and enrichments. No score is at risk. The session requires no network connection.

**Why this priority**: This is the core interaction of the feature. Without the ability to start and complete a rehearse session, none of the other stories have value.

**Independent Test**: Can be fully tested by starting a rehearse session from a phrasebook that has at least one entry with enrichments, navigating through all cards, and verifying that the learning scores of those entries are unchanged after the session ends.

**Acceptance Scenarios**:

1. **Given** the user has a phrasebook with at least one entry, **When** they select "Rehearse" as the review type and start a session, **Then** flashcards are presented one at a time showing all entry metadata including enrichments
2. **Given** a rehearse session is active, **When** the user views a flashcard, **Then** the card displays: source expression, target translation, part of speech, tags, notes, and any enrichments (e.g., example sentences, pronunciation hints, context notes)
3. **Given** a rehearse session is active, **When** the user completes all flashcards or interrupts the session, **Then** the learning score of every entry that appeared in the session remains unchanged
4. **Given** the device has no internet connection, **When** the user starts and completes a rehearse session, **Then** the session runs fully offline with no network requests attempted
5. **Given** a rehearse session is active, **When** the user navigates through cards, **Then** the app shows clear progress (e.g., "Card 3 of 10")

---

### User Story 2 — Navigate Cards with Swipe Gestures on Mobile (Priority: P2)

A learner is rehearsing on their smartphone. Rather than tapping "Next" buttons, they swipe left to advance to the next card and swipe right to go back to the previous card, experiencing a natural, book-like browsing motion through their vocabulary.

**Why this priority**: Touch-native navigation significantly improves mobile usability for rehearsal, which is a common on-the-go activity. It does not affect correctness but meaningfully raises engagement.

**Independent Test**: Can be fully tested on a mobile device (or browser device-emulation mode) by swiping through a rehearse session and verifying that forward and backward navigation works correctly without tapping any buttons.

**Acceptance Scenarios**:

1. **Given** a rehearse session is active on a touch device, **When** the user swipes left, **Then** the app navigates to the next flashcard
2. **Given** a rehearse session is active on a touch device, **When** the user swipes right, **Then** the app navigates to the previous flashcard
3. **Given** the user is on the first card and swipes right, **Then** the swipe is ignored or gently resisted with no navigation occurring
4. **Given** the user is on the last card and swipes left, **Then** the session ends (or a clear end-of-session state is shown)
5. **Given** the user is on a non-touch desktop, **When** they complete a rehearse session, **Then** equivalent keyboard (arrow keys) or button-based navigation is available

---

### User Story 3 — Filter Rehearsal by Part of Speech or Tag (Priority: P2)

Before starting a rehearse session, a learner wants to focus only on nouns from a particular phrasebook, or only on entries tagged "weather vocabulary." They select one or more part-of-speech filters or tag filters, and the session is populated exclusively with matching entries up to the chosen card count.

**Why this priority**: Filtering focuses rehearsal on weak spots or thematic clusters, making sessions more purposeful. It does not change the core rehearsal flow.

**Independent Test**: Can be fully tested by configuring a rehearse session with a specific part-of-speech or tag filter, completing the session, and verifying that only entries matching the filter criteria were shown.

**Acceptance Scenarios**:

1. **Given** a phrasebook has entries with different parts of speech, **When** the user applies a part-of-speech filter before starting, **Then** only entries of the selected part(s) of speech appear in the session
2. **Given** a phrasebook has tagged entries, **When** the user applies a tag filter before starting, **Then** only entries bearing the selected tag(s) appear in the session
3. **Given** the user applies both a part-of-speech filter and a tag filter, **Then** only entries matching both criteria appear (logical AND)
4. **Given** the applied filters match fewer entries than the requested card count, **Then** the session includes all matching entries and the card count is adjusted accordingly, with a visible notice to the user
5. **Given** the applied filters match zero entries, **Then** the user is shown a message explaining why the session cannot start, and is prompted to adjust filters

---

### User Story 4 — Choose Entry Selection Strategy (Priority: P3)

A learner can choose how entries are selected for the rehearse session: either prioritising entries with the lowest learning score (to focus on the weakest vocabulary) or drawing a random sample. The selection strategy is a visible option on the session setup screen.

**Why this priority**: This is a quality-of-life option that mirrors existing review behaviour. It enriches the rehearsal experience but is not required for the feature to be useful.

**Independent Test**: Can be fully tested by starting two rehearse sessions — one with "prioritise low score" and one with "random" — on a phrasebook with entries at varied score levels, and verifying the resulting card sets differ accordingly.

**Acceptance Scenarios**:

1. **Given** the user selects "Prioritise low learning score," **When** the session starts, **Then** entries are sorted by ascending learning score and the lowest-scoring entries fill the session up to the requested card count
2. **Given** the user selects "Random sample," **When** the session starts, **Then** entries are drawn randomly (regardless of score) up to the requested card count
3. **Given** the user has not changed the selection strategy, **Then** a sensible default is pre-selected (random sample)
4. **Given** filters are also applied, **Then** the selection strategy is applied within the filtered subset only

---

### Edge Cases

- What happens when a phrasebook has fewer entries than the requested card count? → Session uses all available matching entries and informs the user.
- What happens when a phrasebook has zero entries? → The rehearse option is disabled or a clear message is shown before the session can be started.
- What happens if the user exits mid-session by closing the app or navigating away? → Session state is discarded; learning scores remain unchanged; no data is lost.
- What happens if an entry has no enrichments? → The flashcard still displays gracefully, showing only the fields that are present; no placeholder text implies missing data is an error.
- What happens if the user applies a filter that returns exactly one entry? → Session proceeds with a single card; the user is informed.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer "Rehearse" as a selectable review type alongside the existing competitive review type on the session setup screen
- **FR-002**: The session setup screen MUST allow the user to select a target phrasebook and specify a card count (number of flashcards)
- **FR-003**: The session setup screen MUST allow the user to optionally filter entries by one or more parts of speech
- **FR-004**: The session setup screen MUST allow the user to optionally filter entries by one or more tags
- **FR-005**: The session setup screen MUST allow the user to choose an entry selection strategy: "Prioritise low learning score" or "Random sample"
- **FR-006**: The system MUST display flashcards strictly one at a time during a rehearse session
- **FR-007**: Each flashcard MUST display all available entry metadata: source expression, target translation, part of speech, tags, notes, and all enrichment fields (example sentences, synonyms, antonyms, collocations, register, false-friend warning)
- **FR-008**: The system MUST show clear session progress at all times (e.g., current card number and total card count)
- **FR-009**: A rehearse session MUST NOT modify the learning score of any entry, regardless of how the session ends
- **FR-010**: The system MUST prominently communicate to the user — both before starting and during the session — that rehearse sessions do not affect the learning score
- **FR-011**: The user MUST be able to interrupt and exit a rehearse session at any point without penalty or data loss
- **FR-012**: On touch-capable devices, the user MUST be able to navigate to the next card by swiping left and to the previous card by swiping right
- **FR-013**: On non-touch devices, equivalent navigation controls (buttons or keyboard shortcuts) MUST be available
- **FR-014**: A rehearse session MUST run entirely client-side, with no network requests made during the session
- **FR-015**: When applied filters match fewer entries than the requested card count, the system MUST notify the user and proceed with the available subset
- **FR-016**: When applied filters match zero entries, the system MUST prevent session start and display an actionable explanation

### Key Entities

- **Rehearse Session Config**: Transient, client-side only; captures selected phrasebook, card count, part-of-speech filters, tag filters, and selection strategy; not persisted beyond the session
- **Flashcard**: A read-only view of a vocabulary entry and all its enrichments; rendered one at a time during the session; carries no mutable state
- **Enrichment**: Any supplemental information attached to a vocabulary entry (e.g., example sentence, usage note, pronunciation hint); displayed but not editable during rehearsal

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure and start a rehearse session in under 30 seconds from the phrasebook view
- **SC-002**: A complete rehearse session of 10 cards can be navigated from start to finish with no errors and no network activity on any supported device
- **SC-003**: 100% of rehearse sessions result in zero learning score changes for any participating entry
- **SC-004**: On a mobile device, users can navigate through an entire rehearse session using only swipe gestures without tapping any navigation buttons
- **SC-005**: The "no score impact" notice is visible at every stage of the session setup and during every flashcard display
- **SC-006**: Users can interrupt any rehearse session at any point and return to the phrasebook view with all entry data intact

---

## Assumptions

- Vocabulary entry enrichments are already stored client-side in IndexedDB and are available without a network request
- The existing session setup UX (phrasebook picker, card count input) from the competitive review will be reused as a foundation for the rehearse setup screen
- Part-of-speech values and tags are already associated with entries in the local data store; no new data collection is required
- The app already has a mechanism to detect touch capability for swipe gesture activation
- Flashcard visual design will follow the existing app design language (CSS Modules, existing component styles); no new design system is required
- The random sample strategy uses a client-side pseudo-random shuffle; cryptographic randomness is not required
- Entry selection (filtering + strategy) is computed entirely in the browser from the local IndexedDB data at session start time
