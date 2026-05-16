# Feature Specification: Data Export & Import

**Feature Branch**: `006-data-export-import`
**Created**: 2026-05-16
**Status**: Draft
**Input**: User description: "Users should be able to export (backup) all their data to a JSON file on the device they're running from and re-import it seamlessly. This should work on any device type or OS. Fields not mandatory when creating phrasebooks/entries through the UI should not be mandatory during bulk-import. Strong consideration on security — the app must not accept potentially malicious files."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export All Data (Priority: P1)

An authenticated user wants to create a backup of all their WordSprout data. They navigate to their account or settings area, trigger an export, and a JSON file containing all their phrasebooks, entries, enrichments, and associated metadata is downloaded to their device.

**Why this priority**: Export is the foundation of the backup/restore cycle. Any user can immediately benefit from it regardless of their current data state, and it has no dependency on the import feature.

**Independent Test**: A user with existing phrasebooks and entries triggers an export. The resulting JSON file can be downloaded and inspected to confirm all data is present, complete, and readable.

**Acceptance Scenarios**:

1. **Given** an authenticated user with existing phrasebooks and entries, **When** they trigger an export, **Then** a JSON file is downloaded to their device containing all phrasebooks, entries, and associated data.
2. **Given** an authenticated user with no phrasebooks or entries, **When** they trigger an export, **Then** a JSON file is still downloaded containing an empty but valid and parseable structure.
3. **Given** an authenticated user, **When** the export completes, **Then** the downloaded filename includes a meaningful reference (e.g., the application name and the current date) so the user can identify the backup file later.

---

### User Story 2 - Import Data (Restore) (Priority: P2)

An authenticated user has a previously exported backup file and wants to restore their data — for example, after switching devices or accounts. They navigate to the import area, select their backup file, confirm they wish to replace their current data, and the system validates and imports the file. A success summary confirms what was restored.

**Why this priority**: Import completes the backup/restore workflow. Without it, the exported file provides read-only reference value at best.

**Independent Test**: A user uploads a valid export file and their data is fully restored, with a clear confirmation summary showing how many phrasebooks and entries were imported.

**Acceptance Scenarios**:

1. **Given** an authenticated user and a valid export file, **When** they upload the file and confirm the action, **Then** all phrasebooks and entries from the file are imported into their account and a success summary is displayed.
2. **Given** a valid export file where entries contain only mandatory fields (all optional fields omitted), **When** the user imports the file, **Then** the import succeeds without validation errors.
3. **Given** an authenticated user who already has data in their account, **When** they upload a valid import file, **Then** the system prompts for explicit confirmation before overwriting existing data.
4. **Given** an authenticated user with existing data, **When** they confirm the import, **Then** their existing data is fully replaced by the imported data with no remnants of the old data.
5. **Given** an authenticated user and an invalid or malicious file, **When** they attempt to upload it, **Then** the import is rejected with a clear, user-friendly error message and no existing data is modified.

---

### User Story 3 - Cross-Device & Cross-Browser Portability (Priority: P3)

A user exports their data on one device or browser (e.g., a desktop running Chrome) and successfully imports it on a different device or operating system (e.g., a mobile device running Safari).

**Why this priority**: Cross-device portability is a stated requirement and validates the platform-agnostic design. However, it is only testable after P1 and P2 are complete.

**Independent Test**: Export performed on a desktop browser; the resulting file is imported on a mobile browser without errors and with full data fidelity.

**Acceptance Scenarios**:

1. **Given** a valid export file created on any supported device and browser, **When** it is imported on a different device or operating system, **Then** the data is imported without errors or data loss.

---

### Edge Cases

- What happens when the uploaded file exceeds the maximum allowed file size?
- What happens when the file is syntactically valid JSON but does not match the expected export schema?
- What happens when text fields in the imported file contain embedded HTML, script tags, or other potentially harmful content?
- What happens when the import is interrupted (e.g., browser closed mid-operation)?
- What happens when the export file was produced by an older or newer version of the application with a different schema?
- What happens when the user uploads a non-JSON file (e.g., `.csv`, `.exe`, `.xml`)?
- What happens when the export file is structurally valid but contains zero phrasebooks and zero entries?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to export all their phrasebooks, entries, enrichments, and associated metadata as a single downloadable JSON file.
- **FR-002**: System MUST allow authenticated users to import a previously exported JSON backup file to restore their data.
- **FR-003**: The export and import flows MUST be completable using standard browser capabilities across all modern browsers and operating systems, without requiring native apps, plugins, or OS-specific integrations.
- **FR-004**: During import, the system MUST validate that the uploaded file is a well-formed JSON file conforming to the expected export schema before processing any data.
- **FR-005**: During import, the system MUST sanitize all text content in the uploaded file to neutralise any embedded scripts, markup, or injection vectors before storing the data.
- **FR-006**: During import, the system MUST apply the same field-level validation rules as the standard user interface — fields that are optional when creating items through the UI must remain optional during import.
- **FR-007**: During import, the system MUST reject files that exceed a defined maximum file size and inform the user with a clear error message.
- **FR-008**: During import, the system MUST reject files that fail schema or content validation and inform the user with a clear, non-technical error message; no data must be written or modified on failure.
- **FR-009**: The system MUST prompt the user for explicit confirmation before overwriting their existing data during an import.
- **FR-010**: After a successful import, the system MUST display a summary indicating how many phrasebooks and entries were imported.
- **FR-011**: The export file MUST embed a schema version identifier to enable compatibility detection during future imports.
- **FR-012**: The system MUST reject import files whose schema version is unrecognised or incompatible, and inform the user with a clear error message.
- **FR-013**: The export filename MUST include the application name and the export date to help users identify backup files.

### Key Entities

- **Export Package**: A structured document capturing all user-owned phrasebooks, entries, enrichments, and metadata at a specific point in time, along with a schema version identifier and export timestamp.
- **Phrasebook**: A named collection of vocabulary entries owned by the user, with optional descriptive attributes (e.g., description, language pair).
- **Entry**: A vocabulary item belonging to a phrasebook, with a mandatory primary term and optional supplementary fields (e.g., translation, notes, tags, pronunciation).
- **Enrichment**: AI-generated supplementary content attached to a vocabulary entry (e.g., example sentences, pronunciation, etymology). Included in the export package and restored on import.
- **Schema Version**: A version marker embedded in the Export Package used to validate compatibility when importing the file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete a full data export in under 10 seconds for collections of up to 500 phrasebooks and 10,000 entries.
- **SC-002**: Users can complete a full data import in under 30 seconds for a file containing up to 500 phrasebooks and 10,000 entries.
- **SC-003**: 100% of valid export files produced by the application can be successfully re-imported without data loss or corruption.
- **SC-004**: 100% of files containing malicious content (e.g., scripts, HTML injection, oversized payloads) are rejected before any data is written to the user's account.
- **SC-005**: The export and import workflow is completable without errors on all major device types (desktop, tablet, mobile) and all major modern browsers.
- **SC-006**: Every category of import failure produces a clear, non-technical error message that helps the user understand what went wrong and how to resolve it.

## Assumptions

- The export and import feature is scoped to user-owned data only; shared or collaborative phrasebook content (if any) is out of scope for this iteration.
- Import performs a full overwrite of the user's existing data; additive/merge import (preserving existing entries) is out of scope for this iteration.
- The feature is available to authenticated users only; unauthenticated access to export or import is not supported.
- File I/O is handled entirely through standard browser file download and upload APIs — no native OS integrations, desktop applications, or third-party cloud storage services are involved.
- The maximum allowed import file size will be determined during planning, informed by realistic data volume estimates; an upper bound in the low tens of megabytes is assumed sufficient.
- The export format is JSON only; alternative formats (CSV, XML, etc.) are out of scope.
- The system will not auto-migrate data from unrecognised schema versions; users must use export files produced by a supported version of the application.
- Partial imports (selecting a subset of phrasebooks from a backup file to restore) are out of scope for this iteration.
- The existing server-side content sanitisation infrastructure is available and will be applied to all imported text content.
