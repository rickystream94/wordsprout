# Feature Specification: Learning Score Decay

**Feature Branch**: `feature/008-learning-score-decay`
**Created**: 2026-05-17
**Status**: Draft
**Input**: User description: "I want the learning score of phrasebook entries to automatically and progressively decrease overtime. The only way to overcome this is to continue practicing via review sessions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Honest Score Reflection After Inactivity (Priority: P1)

A user successfully engraves several phrasebook entries during an active learning period. They then take a break from using WordSprout for several weeks. When they return, they find that some of their previously engraved entries now show a lower learning score, accurately reflecting the likelihood that they may have forgotten those words during their absence.

**Why this priority**: This is the core motivation for the feature. Without it, learning scores become permanently fixed at their peak, misrepresenting a user's actual current knowledge and undermining trust in progress tracking.

**Independent Test**: A user with engraved entries who has not completed any review sessions in over two weeks returns to their phrasebook and sees at least one entry with a reduced learning score. The score reflects the expected reduction based on days elapsed since the last review.

**Acceptance Scenarios**:

1. **Given** a user has an entry at maximum learning score and has not reviewed it for longer than the inactivity threshold, **When** the user opens the phrasebook, **Then** the entry's learning score has decreased proportionally to the time elapsed since the last review.
2. **Given** a user has an entry that has partially decayed, **When** the user checks that entry, **Then** the score accurately reflects the cumulative decay based on days since last review.
3. **Given** a user has an entry at maximum score and continues to review it within the inactivity threshold, **When** the user views the phrasebook, **Then** the learning score remains at maximum and no decay is applied.

---

### User Story 2 - Score Recovery Through Practice (Priority: P2)

A user notices that some of their phrasebook entries show lower scores due to inactivity. They participate in a review session covering those entries and successfully recall them. Their scores improve as a reward for returning to active learning.

**Why this priority**: Without recovery, the decay mechanism becomes purely punitive and demotivating. Restoration of scores through practice closes the feedback loop and reinforces the incentive to keep learning.

**Independent Test**: A user with at least one decayed entry completes a review session covering that entry, answers it correctly, and sees the score increase after the session.

**Acceptance Scenarios**:

1. **Given** a user has an entry with a score reduced by decay, **When** the user successfully reviews that entry in a practice session, **Then** the entry's learning score increases.
2. **Given** a user consistently reviews entries before their scores decay, **When** the user views the phrasebook, **Then** all regularly reviewed entries retain their scores without any reduction.

---

### User Story 3 - Consistent Scores Within a Single Day (Priority: P3)

A user opens WordSprout multiple times throughout the same calendar day. The learning scores they see are consistent across all those visits — decay is computed at most once per calendar day, preventing confusing score changes during a single day's use.

**Why this priority**: Ensuring stability within a day creates a predictable, non-stressful experience and avoids unnecessary re-computation overhead.

**Independent Test**: A user opens the app twice within the same calendar day and observes identical learning scores on both visits (no further decay between visits on the same day).

**Acceptance Scenarios**:

1. **Given** learning scores have already been computed for the current calendar day, **When** the user opens the app again later that same day, **Then** the learning scores remain unchanged.
2. **Given** a new calendar day begins, **When** the user opens the app for the first time that day, **Then** scores are freshly computed based on the updated elapsed days since each entry's last review.

---

### Edge Cases

- What happens when an entry has never been reviewed and sits at the minimum score? → No decay is applied; scores cannot drop below the minimum.
- What happens when a user reviews an entry on the same day its score would decay? → The score resulting from the review session takes precedence over the decayed value.
- What happens if a user changes timezone or device clock? → Date comparisons use UTC calendar dates to ensure consistent, timezone-independent results.
- What happens if all of a user's entries have decayed to the minimum score? → The review session entry selection surfaces low-scoring entries preferentially, helping users rebuild their scores.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST automatically reduce the learning score of phrasebook entries that have not been reviewed within a defined inactivity threshold.
- **FR-002**: The reduction in learning score MUST be calculated based on the number of whole calendar days elapsed since the entry was last reviewed.
- **FR-003**: Learning score decay for all of a user's entries MUST be computed at most once per calendar day.
- **FR-004**: A computed decay result MUST be persisted so the updated score is consistent across the user's sessions and devices. The decay formula MUST produce the same result on any device given the same input fields, ensuring last-write-wins sync does not cause double-decay.
- **FR-005**: Learning scores MUST NOT decay below a floor value of zero.
- **FR-006**: Entries with a learning score already at zero MUST NOT be subject to further decay.
- **FR-007**: Entries with a fully engraved (maximum) learning score MUST be subject to the same decay rules as all other non-zero entries.
- **FR-008**: The decay computation MUST be triggered by user-initiated activity (such as opening the application), not by scheduled background processes or server-side jobs.
- **FR-009**: The last review date used for decay calculation MUST be the most recent date on which the entry was included in a completed review session.
- **FR-010**: The decay model MUST apply a 7-day grace period after the last review date during which no decay occurs. After the grace period expires, the learning score MUST decrease by 1 point for every 3 days elapsed since the grace period ended, rounding down to the nearest whole number.
- **FR-011**: Each phrasebook entry MUST store a `decayBaseScore` field equal to the entry's learning score at the time of its most recent review session completion. The decay formula MUST subtract decay points from `decayBaseScore` (not from `currentScore`) to ensure the computed target score is identical on any device regardless of sync order.
- **FR-012**: The decay grace period and decay rate MUST be configurable via environment-specific settings (not hardcoded) so that lower environments (e.g. local development, staging) can use accelerated values for ease of testing without modifying source code.

### Key Entities

- **Phrasebook Entry**: A vocabulary or phrase item owned by a user. Carries a learning score and a last-reviewed date that anchors decay calculations.
- **Learning Score**: A bounded numeric value representing a user's recall confidence for an entry. Subject to progressive decay based on review recency. Cannot go below zero or above the engraved maximum.
- **Last Reviewed Date**: The calendar date of the most recent completed review session that included the entry. Drives all decay calculations.
- **Decay Computation Record**: A per-user marker indicating the last calendar date on which decay was computed, enforcing the once-per-day rule.
- **Decay Base Score**: The learning score recorded at the moment a review session last touched an entry. Anchors decay calculations so that any device applying the formula to the same entry produces the same result, preventing double-decay in multi-device scenarios.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A fully engraved entry that receives no further reviews reaches the minimum score within the timeframe defined by the agreed decay model.
- **SC-002**: Users who review an entry at least once within the inactivity threshold never experience score decay for that entry.
- **SC-003**: Loading the phrasebook — including any decay computation — completes with no perceptible additional delay compared to the current experience.
- **SC-004**: After completing a review session, any entries covered and correctly answered show a score equal to or greater than their pre-session decayed score.
- **SC-005**: Returning users who have been inactive for longer than the inactivity threshold see at least one decayed score upon reopening the app, confirming the system is active.

## Assumptions

- The maximum learning score (engraved threshold) is already defined in the existing data model; this feature does not modify the maximum value.
- Score recovery after decay follows existing review session scoring mechanics — no new scoring rules are introduced.
- All date comparisons use UTC calendar dates to ensure consistency regardless of user timezone or device clock.
- The decay computation is triggered by user-initiated actions (opening the app, loading the phrasebook) and does not depend on scheduled background processes or server-side jobs running independently of user activity.
- The feature targets the existing phrasebook entry data model; `decayBaseScore` is the only new field added to the entry.
- Mobile and desktop experiences behave identically with respect to decay; the platform does not affect score calculations.
- Multi-device users are protected from double-decay by the `decayBaseScore` anchor field. Last-write-wins conflict resolution is safe because any device computing decay from the same `decayBaseScore` + `lastReviewedDate` arrives at the same target score.

## Clarifications

### Session 2026-05-17

- Q: Multi-device decay idempotency — what strategy prevents double-decay when two devices apply decay before syncing? → A: Option A — add `decayBaseScore` field set on each review completion; decay formula targets `decayBaseScore − decayPoints` instead of `currentScore − decayPoints`, making it idempotent across devices.
- Q: What is the grace period? → A: 7 days (changed from original 14 days).
- Q: Should decay constants be hardcoded or configurable per environment? → A: Environment-configurable via build-time settings; production defaults are 7-day grace and 3-day rate; lower environments override freely for testing.
