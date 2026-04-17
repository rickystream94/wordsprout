# Feature Specification: Adaptive Learning State & Redesigned Review Sessions

**Feature Branch**: `002-adaptive-learning-state`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "Redesign the Learning State from a manual enum (New/Learning/Mastered) to an automatic point-based system with a heat-map progress bar; redesign Review sessions to use typed-translation flashcards with scoring, hints, typo tolerance, non-transactional progress, multiple session types, and a daily review limit per entry."

---

## Clarifications

### Session 2026-04-17

- Q: Should scoring be client-side (optimistic, synced as raw score) or server-side (server re-computes from raw review inputs) to guard against API abuse? → A: **Option A — Server bounds validation only.** Scoring computation remains client-side for full offline compatibility. The server enforces two constraints on every `PUT /entries/:id` score update: (1) the delta between the new and current stored `learningScore` must not exceed +10 (gain cap) or fall below −5 (loss floor); (2) the `lastReviewedDate` in the request must differ from the stored value (daily limit also enforced server-side). This means the worst a malicious user can achieve is +10 points per entry per day via direct API calls — reaching 100 from 0 takes a minimum of 10 days. This risk level is explicitly accepted as tolerable given the personal-app context.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Visual Learning Progress at a Glance (Priority: P1)

A language learner opens their phrasebook and wants to quickly see which entries they've been struggling with and which ones they've mastered. Instead of a simple "New / Learning / Mastered" label, each entry displays a color-coded progress bar that visually communicates its position on the mastery scale — cold-toned for weak entries, warm-toned for strong ones.

**Why this priority**: The visual progress indicator is the central UX change of this feature and affects every entry in every phrasebook. It replaces the existing manual label and is the first thing users encounter.

**Independent Test**: Can be fully tested by viewing a phrasebook list and verifying that entries at different point levels display appropriately scaled, color-coded progress bars — no review session needed.

**Acceptance Scenarios**:

1. **Given** a phrasebook with entries at various point levels, **When** the user opens the phrasebook, **Then** each entry displays a heat-map style progress bar reflecting its relative mastery score
2. **Given** an entry with 0 points, **When** displayed, **Then** the bar appears fully cold (represents the New state)
3. **Given** an entry with the maximum point score, **When** displayed, **Then** the bar appears fully warm (represents the Mastered state)
4. **Given** an entry with an intermediate score, **When** displayed, **Then** the bar fill is proportional to the score within the 0–100 range
5. **Given** a user views entry details, **When** the entry's score changes, **Then** the progress bar updates immediately without requiring a page reload

---

### User Story 2 — Earn Points Through Active Review (Priority: P1)

A learner starts a review session to practice vocabulary. For each flashcard, they are shown the source-language expression and must type the translation into the target language. Correct answers increase the entry's learning score; skipping or answering incorrectly decreases it. Progress is saved the moment each flashcard is evaluated.

**Why this priority**: This is the core interaction driving the entire adaptive learning system. All score changes originate here.

**Independent Test**: Can be fully tested by running a review session, submitting correct and incorrect answers, exiting mid-session, and verifying that point changes are immediately reflected on individual entries.

**Acceptance Scenarios**:

1. **Given** a review session is active, **When** the user types the correct translation with no hints and no typos, **Then** the entry gains the full point increment (capped at 100)
2. **Given** a review session is active, **When** the user skips a flashcard, **Then** the entry loses points (minimum score is 0)
3. **Given** a review session is active, **When** the user submits an incorrect answer, **Then** the entry loses points (minimum score is 0)
4. **Given** the system compares translations, **When** the user's input and the expected answer differ only by punctuation, surrounding whitespace, or dashes, **Then** the comparison treats them as equivalent
5. **Given** an entry is at 0 points, **When** the user skips or answers incorrectly, **Then** the entry remains at 0 (no negative scores)
6. **Given** a flashcard is evaluated, **When** the result is computed, **Then** the entry's updated score is persisted immediately — before the next flashcard is shown

---

### User Story 3 — Use Hints to Aid Recall (Priority: P2)

A learner is struggling to recall the translation for a flashcard. They request a hint and one random unrevealed letter of the target answer is pre-filled in the input. They can request more hints. If they eventually answer correctly, their point gain is reduced proportionally based on how many hints were used relative to the answer's length.

**Why this priority**: Hints reduce frustration for genuinely difficult entries while preserving the incentive to recall answers independently through proportional scoring trade-offs.

**Independent Test**: Can be tested by requesting varying numbers of hints and confirming that correct answers with more hints produce smaller point gains than correct answers with fewer hints.

**Acceptance Scenarios**:

1. **Given** a flashcard is showing, **When** the user requests a hint, **Then** one randomly chosen unrevealed character of the normalized target answer is pre-filled in the input field
2. **Given** the user has used hints equal to 50% of the answer's character length, **When** they answer correctly, **Then** points gained are significantly less than a comparable hint-free correct answer
3. **Given** the user requests hints covering nearly all characters and types the remainder correctly, **When** submitted, **Then** the point gain is near the minimum positive increment
4. **Given** multiple hints have been used, **When** the user answers incorrectly, **Then** the normal point deduction applies regardless of hints used

---

### User Story 4 — Flexible Session Types (Priority: P2)

Before starting a review session, a learner chooses between two session types: a **Random** session where flashcards are drawn from all entries (including mastered ones), or a **Targeted** session focused exclusively on the weakest entries (below the Mastered threshold). The learner also sets how many flashcards they want in the session.

**Why this priority**: Gives users meaningful agency over how they practice, improving session relevance and long-term motivation.

**Independent Test**: Can be tested by initiating each session type separately and confirming that a Targeted session never surfaces Mastered entries, while a Random session may include entries at any level.

**Acceptance Scenarios**:

1. **Given** a user initiates a Random session, **When** flashcards are generated, **Then** entries from any points level — including Mastered — are eligible for inclusion
2. **Given** a user initiates a Targeted session, **When** flashcards are generated, **Then** only entries below the Mastered threshold are included
3. **Given** fewer eligible entries exist than the user's requested session size, **When** the session starts, **Then** the session contains all available eligible entries without error
4. **Given** a user has started a session and answered some flashcards, **When** they exit mid-session, **Then** all points earned or lost for evaluated flashcards are retained (no rollback)
5. **Given** there are zero eligible entries for a Targeted session, **When** the user tries to start one, **Then** the system informs the user that there are no entries to review and does not start a session

---

### User Story 5 — Daily Review Limit Per Entry (Priority: P3)

To encourage sustainable practice and prevent score inflation, each phrasebook entry can have its score affected by review at most once per day. If an entry already reviewed today appears in a session, the flashcard is shown but submitting any answer produces no point change. A visual indicator on the card communicates this state.

**Why this priority**: Protects the integrity of the scoring system and encourages users to practice broadly rather than drilling a single entry repeatedly.

**Independent Test**: Can be tested by reviewing an entry, then attempting to review the same entry again on the same calendar day and verifying that submitting answers produces no score change.

**Acceptance Scenarios**:

1. **Given** an entry has been reviewed today, **When** it appears in a session, **Then** a visual indicator on the flashcard communicates that this entry's score will not change
2. **Given** an entry has been reviewed today, **When** the user submits any answer, **Then** no points are added or deducted from that entry
3. **Given** an entry was last reviewed on a previous calendar day, **When** a new day begins (midnight, user's local time), **Then** the entry is eligible for score-affecting review again

---

### Edge Cases

- What happens when a phrasebook has no entries eligible for a Targeted session (all entries are Mastered)?
- How does normalization handle entries written entirely in non-Latin scripts (Arabic, Chinese, Japanese, Hebrew)?
- What if the expected translation contains numbers or special characters that are not punctuation (e.g., "H₂O", "C#")?
- What happens if the user rapidly requests all available hints for a very short answer (1–2 characters)?
- What happens when session size preference exceeds the total number of entries in the phrasebook?
- How does the daily review limit behave if the user's device clock differs significantly from the server clock?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each phrasebook entry MUST have a numeric learning score (integer, 0–100), replacing the existing enum-based learning state field
- **FR-002**: Three named ranges MUST be defined for display and session-filtering purposes: **New** (0–25), **Learning** (26–79), **Mastered** (80–100)
- **FR-003**: The learning score MUST be visually represented as a color-coded, heat-map style progress bar on each entry in the phrasebook view
- **FR-004**: Review sessions MUST present flashcards one at a time: the source-language field is displayed as the prompt; the user must type the target-language translation
- **FR-005**: Before comparing translations, the system MUST normalize both the user's input and the expected answer by: removing all punctuation, removing leading/trailing whitespace, collapsing internal whitespace, removing dashes; the comparison MUST be case-insensitive
- **FR-006**: Normalization and comparison logic MUST be language-agnostic with no character-set assumptions
- **FR-007**: A correct answer (after normalization) with no hints and no typos MUST award **+10 points** (capped at 100 total)
- **FR-008**: An incorrect answer or skip MUST deduct **5 points** from the entry's score (minimum score is 0; no negative scores permitted)
- **FR-009**: The system MUST tolerate minor typos in user answers: up to **1 typo per 5 characters** of the normalized expected answer length (minimum 1 typo always allowed); answers within this tolerance MUST be counted as correct
- **FR-010**: A typo-correct answer MUST award **80% of the calculated point gain** (rounded down, minimum 1 point if gain > 0)
- **FR-011**: Users MAY request hints during a flashcard; each hint MUST pre-fill one randomly selected unrevealed character of the (normalized) target translation in the input field
- **FR-012**: Hint penalty MUST reduce point gain proportionally using: `hint_factor = 1 – (hints_used / normalized_answer_length)`; if `hint_factor ≤ 0`, the gain is 1 point (minimum positive gain)
- **FR-013**: Typo and hint penalties MUST stack multiplicatively: `final_gain = base_gain × hint_factor × typo_factor` (rounded down, minimum 1 if a gain would otherwise occur)
- **FR-014**: Session progress MUST be persisted immediately upon evaluating each flashcard; users MAY exit a session at any point without losing accumulated score changes
- **FR-015**: Two session types MUST be supported: **Random** (all entries eligible regardless of score) and **Targeted** (only entries in the New or Learning ranges are eligible)
- **FR-016**: Users MUST be able to set a preferred session size (number of flashcards) before starting; if fewer eligible entries exist than the requested size, the session uses all available eligible entries
- **FR-017**: Each entry's score MAY be affected by review at most **once per calendar day** (midnight-to-midnight in the user's local time); subsequent appearances of the same entry in that day's sessions MUST show the flashcard but produce no score change
- **FR-018**: A flashcard for an already-reviewed-today entry MUST display a visible indicator communicating that no score change will occur
- **FR-019**: If a Targeted session is requested and zero eligible entries exist, the system MUST notify the user and NOT start the session
- **FR-020**: Existing entries carrying enum-based states MUST be migrated automatically: **New** → 0 points, **Learning** → 30 points, **Mastered** → 90 points
- **FR-021**: The server MUST enforce a per-request score delta constraint on `PUT /entries/:id`: the difference between the submitted `learningScore` and the entry's current stored score MUST be within [−5, +10]; requests outside this range MUST be rejected with HTTP 400
- **FR-022**: The server MUST enforce the daily review limit independently of the client: if the submitted `lastReviewedDate` equals the entry's current stored `lastReviewedDate`, the server MUST reject score-changing updates with HTTP 400

### Key Entities

- **LearningScore**: A numeric value (0–100) representing cumulative mastery for a single phrasebook entry; replaces the former LearningState enum
- **ReviewSession**: A user-initiated practice event with a defined type (Random or Targeted), a requested size, and a set of selected entries
- **Flashcard**: A single review unit within a session — the source-language prompt paired with an expected target-language answer
- **ReviewRecord**: A per-entry daily log recording whether the entry has been reviewed and the resulting score delta; used to enforce the daily review limit

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can visually distinguish entry mastery levels at a glance (cold vs. warm progress bar) without reading any text label — validated through usability observation
- **SC-002**: A review session can be started, partially completed, and exited within 60 seconds while retaining all previously computed score changes
- **SC-003**: Translation comparison correctly treats normalized-equivalent answers (differing only by punctuation, case, spaces, or dashes) as correct in 100% of test cases
- **SC-004**: Score changes are reflected on entry progress bars immediately after each flashcard is evaluated — no page reload required
- **SC-005**: Targeted sessions exclusively surface entries below the Mastered threshold — verified across random samples of all phrasebooks
- **SC-006**: The daily review limit prevents score changes for a repeated same-day review of an entry in 100% of tested scenarios
- **SC-007**: All existing entries are correctly migrated from the enum state to the appropriate numeric score without data loss

---

## Assumptions

- Points do **not** decay over time; scores only change through active review sessions (time-based decay is out of scope for this feature)
- The source-language field is always the flashcard prompt; the target-language field is always the expected answer — consistent with the phrasebook's defined source → target direction
- Session size defaults to 20 flashcards but is configurable by the user at session start
- The "once per day" review limit resets at midnight in the user's local device time zone
- Hints reveal characters from the normalized form of the answer; the characters are displayed in their original (un-normalized) positions in the input where possible
- Scoring computation is client-side to preserve full offline capability; the client scores optimistically for immediate UX and queues a `PUT /entries/:id` mutation with the resulting `learningScore` and `lastReviewedDate`
- The server is the authoritative store but does not re-compute scores; it validates that each update's delta is within bounds (FR-021) and that the daily limit is respected (FR-022) before persisting
- Existing phrasebook entries with the old enum-based learning state will be migrated automatically on first load after the feature is deployed
- The maximum point increment (+10) and deduction (−5) values represent a deliberate asymmetry — earning mastery is meaningfully harder than losing it
