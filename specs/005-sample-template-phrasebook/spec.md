# Feature Specification: Sample Template Phrasebook

**Feature Branch**: `feature/005-sample-template-phrasebook`
**Created**: 2026-05-15
**Status**: Draft
**Input**: User description: "Implement the ability to generate a sample template phrasebook with a fixed set of hardcoded entries. Users choose source/target language combinations (source always English, target up to 10 most common Indo-European languages). App generates a phrasebook pre-populated with 50 fixed entries including tags and enrichments. Learning scores start at 0. More discoverable for users with no phrasebook yet."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New User Generates Starter Phrasebook (Priority: P1)

A first-time user opens the app to find their phrasebook list empty. The app prominently presents the option to generate a ready-made starter phrasebook. The user selects their target language (e.g., Spanish), confirms, and immediately has a fully populated phrasebook with 50 vocabulary entries — complete with tags and enrichments — ready to use in review sessions.

**Why this priority**: This is the primary value proposition of the feature. New users who face an empty app are most at risk of abandoning it before discovering its benefits. Providing an instant, meaningful starting point is critical for early engagement.

**Independent Test**: Can be fully tested by creating a new account with no phrasebooks, locating the starter phrasebook prompt on the phrasebooks page, selecting English → Spanish, generating, and verifying all 50 entries appear with tags and enrichments — without any other feature interaction.

**Acceptance Scenarios**:

1. **Given** a user has no phrasebooks, **When** they visit the phrasebooks section, **Then** a prominent call-to-action to generate a starter phrasebook is displayed above or in place of the empty state
2. **Given** the user selects a target language and confirms generation, **When** generation completes, **Then** a new phrasebook containing exactly 50 entries appears in their phrasebook list
3. **Given** the generated phrasebook exists, **When** the user opens a review session for it, **Then** all 50 entries are available and have learning scores starting at 0
4. **Given** the generated phrasebook exists, **When** the user inspects any entry, **Then** the entry displays the English source word, its target-language translation, at least one category tag, and enrichment content (definition and example usage)

---

### User Story 2 - Existing User Adds a Template Phrasebook (Priority: P2)

A user who already has one or more phrasebooks wants to quickly add a starter set for a new language. They find the template phrasebook option accessible (though less prominent) in the phrasebooks section, select their new target language, and generate a second ready-made phrasebook without disrupting their existing data.

**Why this priority**: Existing users benefit from the feature too, particularly when exploring a new language. The accessibility requirement is important, but the discoverability urgency is lower than for new users.

**Independent Test**: Can be tested by a user who already has at least one phrasebook, navigating to the phrasebooks section, locating the template generation option (e.g., via a button or menu), generating English → French, and verifying it appears as a separate phrasebook alongside existing ones.

**Acceptance Scenarios**:

1. **Given** a user has at least one existing phrasebook, **When** they visit the phrasebooks section, **Then** an option to generate a template phrasebook is accessible (button, menu item, or similar control)
2. **Given** the user generates a template phrasebook, **When** generation completes, **Then** the new template phrasebook appears in the list without altering any existing phrasebooks
3. **Given** the user has template phrasebooks for multiple languages, **When** they view their phrasebook list, **Then** each template phrasebook is clearly identifiable as a starter/template phrasebook

---

### User Story 3 - User Selects Target Language for Template (Priority: P2)

Before generating a template phrasebook, the user is presented with a language selection step. They can choose any one of the supported target languages. English is always the source language. The list is constrained to the 10 supported Indo-European languages.

**Why this priority**: Language selection is core to the generation flow but depends on P1 for context. It is equally applicable to new and existing users.

**Independent Test**: Can be tested by opening the template generation flow and verifying that exactly 10 target language options are presented, that English is displayed as the fixed source language, and that selecting each option is possible before confirming.

**Acceptance Scenarios**:

1. **Given** the user initiates template phrasebook generation, **When** the language selection step is shown, **Then** English is displayed as the fixed source language and cannot be changed
2. **Given** the language selection step is shown, **When** the user reviews the options, **Then** exactly the 10 supported Indo-European target languages are listed
3. **Given** the user selects a language and confirms, **When** the phrasebook is generated, **Then** all 50 entries contain translations in the selected target language
4. **Given** the user already has a phrasebook (template or manual) with the same source/target language combination, **When** they attempt to generate a template for that same language pair, **Then** the system blocks the action and displays a message explaining a phrasebook for that language pair already exists

---

### User Story 4 - User Explores and Uses Template Entries (Priority: P3)

After generating a template phrasebook, the user can browse, edit, or delete individual entries just as they would with any self-created phrasebook. The template phrasebook is a full citizen of their collection — not a locked or read-only artefact.

**Why this priority**: This is a usability quality-of-life requirement. The template phrasebook must not be a walled garden; however, this behaviour is largely inherited from the existing phrasebook system rather than new work.

**Independent Test**: Can be tested by generating a template phrasebook, editing one entry's translation, deleting another entry, and verifying both actions succeed and persist.

**Acceptance Scenarios**:

1. **Given** a generated template phrasebook, **When** the user edits an entry, **Then** the change is saved and reflected in review sessions
2. **Given** a generated template phrasebook, **When** the user deletes an entry, **Then** the entry is removed and the phrasebook continues to function normally
3. **Given** a generated template phrasebook, **When** the user renames the phrasebook, **Then** the new name is saved successfully

---

### Edge Cases

- A user attempts to generate a template phrasebook for a language they already have a phrasebook for (either template-generated or manually created with the same source/target language combination): the system blocks generation and informs the user they already have a phrasebook for that language pair
- A user attempts to create a phrasebook (manually) with the same source/target language combination as an existing phrasebook: the system blocks creation in the same way
- What happens if the user cancels mid-way through the language selection step?
- How does the app handle generation if the user is offline?
- What is the entry count behaviour if a user has deleted entries — does the phrasebook still display as a "template" phrasebook?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a template phrasebook generation capability accessible from the phrasebooks section of the app
- **FR-002**: System MUST prominently surface the template phrasebook generation option when a user has no existing phrasebooks (empty state)
- **FR-003**: System MUST offer exactly 10 Indo-European target languages for template phrasebook generation (English is always the source)
- **FR-004**: Each generated template phrasebook MUST contain exactly 50 pre-defined vocabulary entries
- **FR-005**: Each template entry MUST include the English source word, the target-language translation, at least one category tag, and enrichment content (example sentences, synonyms, and collocations)
- **FR-006**: Learning scores for all generated template entries MUST be initialised at 0, with no artificial head-start applied
- **FR-007**: Generated template phrasebook entries MUST be identical for all users choosing the same language combination
- **FR-008**: A generated template phrasebook MUST behave identically to a user-created phrasebook once generated (entries are editable, deletable, and available in review sessions)
- **FR-009**: The template generation flow MUST require the user to actively select a target language before generating; no language is pre-selected by default
- **FR-010**: System MUST clearly indicate to the user which phrasebook(s) were created from a template (e.g., via a label or badge)
- **FR-011**: System MUST prevent users from creating more than one phrasebook with the same source and target language combination, regardless of whether the phrasebook was created manually or via a template; an informative error or blocking message MUST be shown when a duplicate is attempted

### Key Entities

- **Template Phrasebook**: A phrasebook instance created from a pre-defined template for a given English–target-language pair. Contains 50 fixed entries and is marked as originating from a template.
- **Template Entry**: A vocabulary item with a fixed English source word, target-language translation, category tags, and enrichment data. Learning progress is tracked independently per user from a starting score of 0.
- **Supported Language Pair**: A valid combination of English (source) and one of the 10 supported Indo-European target languages. Determines which set of 50 hardcoded translations is used.

### Supported Target Languages

The 10 supported Indo-European target languages are:

1. Spanish
2. Portuguese
3. French
4. German
5. Italian
6. Russian
7. Polish
8. Dutch
9. Romanian
10. Hindi

### Template Vocabulary Categories

The 50 hardcoded entries span the following everyday vocabulary categories, chosen to maximise immediate usefulness for a language learner:

| Category | Approx. Count | Examples |
|----------|--------------|---------|
| Greetings & Social | 8 | hello, goodbye, please, thank you, sorry, yes, no, excuse me |
| Numbers | 10 | one through ten |
| Colors | 6 | red, blue, green, yellow, black, white |
| Time & Days | 7 | today, tomorrow, yesterday, morning, evening, Monday, Sunday |
| Food & Drink | 8 | water, bread, coffee, tea, apple, chicken, rice, wine |
| Travel & Directions | 6 | left, right, here, there, hotel, train station |
| People & Family | 5 | mother, father, friend, man, woman |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user with no phrasebooks can discover, select a language, and complete template phrasebook generation in under 30 seconds from the moment they arrive at the phrasebooks section
- **SC-002**: All 50 template entries are immediately accessible in a review session within 5 seconds of phrasebook generation completing
- **SC-003**: The template generation option is discoverable without external guidance — at least 90% of new users in usability testing find it on the phrasebooks screen without being prompted
- **SC-004**: Template phrasebooks are available for all 10 supported language combinations with 100% entry coverage (no missing translations)
- **SC-005**: Every generated entry has a correctly initialised learning score of 0 — zero entries start with any pre-existing progress

## Assumptions

- The app already supports all 10 listed target languages within its existing language infrastructure (including non-Latin scripts such as Devanagari for Hindi and Cyrillic for Russian)
- Template phrasebook data (words, translations, tags, enrichments) is hardcoded in the application bundle and does not require a network request to generate
- Users may freely modify, delete, rename, or otherwise interact with a generated template phrasebook after creation — it is not locked or read-only
- The vocabulary categories and entry selection (50 words) will be finalised and hardcoded during implementation; translations for all 10 languages will be provided as static data
- A generated template phrasebook uses the same underlying data structure as any user-created phrasebook
- No server-side processing is required at generation time — the phrasebook is created client-side from static data and then synced normally
- Users may generate template phrasebooks for any of the 10 supported language combinations, subject to the one-phrasebook-per-language-pair constraint; each unique language pair is permitted at most one phrasebook
