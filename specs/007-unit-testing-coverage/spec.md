# Feature Specification: Unit Testing Coverage

**Feature Branch**: `feature/007-unit-testing-coverage`
**Created**: 2026-05-16
**Status**: Draft
**Input**: User description: "WordSprout is growing in number of features, but we still have 0 UTs across the whole app. I want to implement UTs that cover both the core UI and API business logic. Goal is to reach a strong code coverage via UTs. We should also make sure that copilot instructions / constitution are updated to make sure that we always implement UTs whenever we add new features or make changes to the core business logic."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - API Business Logic Test Suite (Priority: P1)

As a developer, I want unit tests for the core API business logic (services, utilities, middleware, and function handlers) so that I can verify correctness and catch regressions without deploying to a live environment.

**Why this priority**: The API contains all critical business logic — entry management, enrichment, data portability, authentication, and access controls. A regression here silently breaks user data or security guarantees. This is the highest-risk area and provides the most value tested first.

**Independent Test**: Can be fully tested by running the API test suite in isolation and verifying all business logic functions produce expected outputs for given inputs, entirely without a running server or real database.

**Acceptance Scenarios**:

1. **Given** a developer is working on the API, **When** they run the API test command, **Then** all unit tests pass and a code coverage report is generated showing coverage percentage per module.
2. **Given** a service function receives valid inputs, **When** the test is executed, **Then** the function returns the expected result without calling external services (dependencies are isolated via mocks/stubs).
3. **Given** a service function receives invalid or boundary inputs, **When** the test is executed, **Then** the function returns the expected error or gracefully handles the edge case.
4. **Given** a developer introduces a bug in a covered business logic function, **When** they run the test suite, **Then** at least one test fails, alerting them to the regression before it reaches production.

---

### User Story 2 - Frontend UI & Service Test Suite (Priority: P2)

As a developer, I want unit tests for core frontend components, hooks, and service utilities so that I can verify UI behaviour and client-side logic independently of the backend.

**Why this priority**: The frontend contains non-trivial logic — adaptive learning state, search, offline-first data management, and MSAL authentication flows. Validating these in isolation prevents silent regressions as the feature set grows.

**Independent Test**: Can be fully tested by running the frontend test suite in isolation, verifying component rendering, hook behaviour, and service utility outputs, without a running API or browser.

**Acceptance Scenarios**:

1. **Given** a developer is working on the frontend, **When** they run the frontend test command, **Then** all unit tests pass and a coverage report is generated for components, hooks, and services.
2. **Given** a UI component receives a set of props or state, **When** the test renders it, **Then** the component produces the expected output and responds correctly to user interactions.
3. **Given** a frontend service or utility function receives inputs, **When** the test is executed, **Then** it returns the expected output with external dependencies (API calls, IndexedDB) properly isolated.
4. **Given** a developer changes a core hook or utility, **When** they run the test suite, **Then** any affected tests fail immediately, highlighting the impact of the change.

---

### User Story 3 - Coverage Threshold Enforcement (Priority: P3)

As a developer or CI reviewer, I want minimum code coverage thresholds enforced automatically so that the codebase cannot regress to a low-coverage state as new features are added.

**Why this priority**: Without enforcement, coverage naturally erodes. Thresholds create a safety net that requires every contributor to maintain test discipline.

**Independent Test**: Can be tested by temporarily lowering coverage below the threshold and verifying the test command exits with a non-zero code and a clear threshold-failure message.

**Acceptance Scenarios**:

1. **Given** the test suite runs and overall coverage meets or exceeds the defined threshold, **When** the suite completes, **Then** the process exits successfully (exit code 0).
2. **Given** the test suite runs and overall coverage falls below the defined threshold, **When** the suite completes, **Then** the process exits with an error and clearly states which coverage dimension failed and by how much.
3. **Given** a CI pipeline runs on a pull request, **When** coverage thresholds are not met, **Then** the pipeline fails and prevents the PR from being merged.

---

### User Story 4 - AI Coding Assistant UT Guidelines (Priority: P4)

As a developer using the AI coding assistant (GitHub Copilot) to implement new features or modify business logic, I want the assistant's instructions to automatically require unit tests for every such change, so that new code consistently arrives with tests from day one.

**Why this priority**: Establishing the habit via tooling instructions is the lowest-friction, highest-consistency enforcement mechanism. It prevents test debt from accumulating in future features.

**Independent Test**: Can be tested by asking the AI coding assistant to implement a new business logic function without mentioning tests — the assistant must proactively include unit tests and reference the UT guidelines.

**Acceptance Scenarios**:

1. **Given** the project copilot instructions are updated, **When** the AI assistant is asked to add a new API endpoint or service function, **Then** it generates the implementation code and corresponding unit tests together.
2. **Given** the project copilot instructions are updated, **When** the AI assistant is asked to modify an existing frontend component or hook, **Then** it updates or adds unit tests to reflect the change.
3. **Given** the project constitution is updated, **When** a developer reviews contribution guidelines, **Then** the guidelines clearly state that unit tests are required for all new business logic and core UI changes.

---

### Edge Cases

- What happens when a test suite has no tests yet? The coverage report should indicate 0% coverage (not fail to produce a report), and the threshold check should fail clearly.
- How does the system handle tests that depend on environment variables or secrets? Tests must be runnable without real secrets — sensitive dependencies must be injectable and replaceable with safe test doubles.
- What happens when a new developer adds a feature without tests and the CI threshold enforcement is not yet active? The constitution and copilot instructions serve as the human/AI-layer guard; CI enforcement is the automated layer — both must be present.
- How are third-party integrations (Cosmos DB, Azure Functions runtime, MSAL) handled in unit tests? They must be fully stubbed/mocked so tests never make real network calls.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The API test suite MUST cover all service modules, utility functions, and request-processing middleware with unit tests that isolate external dependencies.
- **FR-002**: The frontend test suite MUST cover core components, custom hooks, and service/utility modules with unit tests that isolate external dependencies (API calls, IndexedDB, MSAL).
- **FR-003**: Both test suites MUST produce a code coverage report (per-file and aggregate) on every run.
- **FR-004**: Both test suites MUST enforce minimum coverage thresholds and exit with a failure code when thresholds are not met.
- **FR-005**: Tests MUST be executable with a single command per package (frontend and API independently), without requiring a running server, database, or external service.
- **FR-006**: Tests MUST run deterministically — the same test input must always produce the same result regardless of run order or environment state.
- **FR-007**: The project's AI coding assistant instructions (copilot-instructions.md) MUST be updated to require that all new API and frontend business logic changes include corresponding unit tests.
- **FR-008**: The project constitution (if present) MUST be updated to codify unit testing as a mandatory contribution requirement for new features and business logic modifications.
- **FR-009**: Coverage thresholds MUST be applied per logical domain (API, frontend) independently so that a well-tested API cannot mask an under-tested frontend.
- **FR-010**: All tests MUST be co-located with or clearly associated with the source code they test, following a consistent file naming convention.

### Key Entities

- **Unit Test**: An isolated, automated test that validates a single function or component in isolation, with all external dependencies replaced by controlled substitutes.
- **Code Coverage**: A measurement (as a percentage) of how much of the source code is exercised by the unit tests, broken down by statements, branches, and functions.
- **Coverage Threshold**: A minimum acceptable coverage percentage, below which the test suite is considered to have failed.
- **Test Double**: A substitute for a real dependency (mock, stub, spy, or fake) used to isolate the unit under test from external systems.
- **AI Coding Guidelines**: Machine-readable instructions (in copilot-instructions.md) that direct the AI coding assistant's behaviour when generating or modifying code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 80% of API business logic functions (services, utils, middleware handlers) are covered by passing unit tests at the end of this feature.
- **SC-002**: At least 70% of frontend components, hooks, and service utilities are covered by passing unit tests at the end of this feature.
- **SC-003**: A developer can run the full test suite (both API and frontend) locally in under 60 seconds on a standard development machine.
- **SC-004**: Zero tests rely on real external services, network calls, or persistent state — all dependencies are isolated via test doubles.
- **SC-005**: After the copilot instructions update, the AI coding assistant includes unit tests without explicit prompting when generating new business logic in at least 3 consecutive validation scenarios.
- **SC-006**: The CI pipeline rejects any pull request where the test suite fails or coverage drops below the defined threshold.
- **SC-007**: The project constitution and copilot instructions explicitly document the unit testing requirement, making it discoverable to any new contributor within 5 minutes of reading the contribution guidelines.

## Assumptions

- Vitest is already configured as the test runner for both the frontend and API packages (vitest.config.ts exists in both `frontend/` and `api/`), so no new test-runner infrastructure needs to be introduced.
- The initial test coverage targets (80% API, 70% frontend) are considered achievable within this feature iteration; they may be raised in a future feature.
- External dependencies (Azure Cosmos DB, Azure Functions runtime, MSAL, Dexie/IndexedDB) will be mocked/stubbed in all unit tests — integration or end-to-end tests are out of scope for this feature.
- The AI coding assistant (GitHub Copilot) reads `.github/copilot-instructions.md` as its primary project instruction source; updating this file is sufficient to change its behaviour.
- The project constitution lives at `.specify/constitution.md` or an equivalent project-level document; its exact location will be confirmed during planning.
- Mobile and browser cross-compatibility of the tests themselves is out of scope — tests run in a Node.js/jsdom environment only.
- Performance benchmarking, snapshot testing, and end-to-end (browser automation) tests are out of scope for this feature.
