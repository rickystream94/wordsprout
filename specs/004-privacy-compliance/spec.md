# Feature Specification: Privacy & Compliance

**Feature Branch**: `004-privacy-compliance`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description: "We need to work on Privacy and compliance for this project. We need a Privacy Policy page (purely informational). Please generate a privacy policy. We need a Terms and conditions page (purely informational). Please generate a T&C. We must provide users with the ability to delete their account and all data associated with it."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Delete Account and All Data (Priority: P1)

A registered user decides they no longer want to use WordSprout. They navigate to their account
settings and initiate an account deletion request. The app asks them to confirm the action,
clearly stating that all phrasebooks, vocabulary entries, notes, and learning progress will be
permanently erased. Once confirmed, all personal data is removed from the cloud and from the
local device, and the user is signed out.

**Why this priority**: This is the highest-priority item because it is a legal obligation under
data protection law (right to erasure / right to be forgotten). Failure to implement it is a
compliance gap that affects every user of the service. It also directly follows from the
Privacy Policy commitment to allow deletion.

**Independent Test**: A user who has at least one phrasebook with vocabulary entries can open
account settings, tap "Delete Account", confirm the prompt, and observe that they are signed
out, their local data is gone, and if they sign in again they have no data.

**Acceptance Scenarios**:

1. **Given** a signed-in user with phrasebooks and entries, **When** they navigate to account
   settings and select "Delete Account", **Then** a confirmation dialog is shown that lists
   what will be permanently deleted and warns the action is irreversible.
2. **Given** the confirmation dialog is shown, **When** the user dismisses it (cancels),
   **Then** no data is deleted and the user remains signed in.
3. **Given** the confirmation dialog is shown, **When** the user confirms deletion,
   **Then** all server-side records for that user are permanently deleted (phrasebooks,
   entries, AI enrichments, user profile, and allowlist record), all local device data is
   cleared, and the user is signed out and redirected to the login page.
4. **Given** deletion is confirmed, **When** the deletion process fails mid-way (e.g., network
   error), **Then** the user is informed of the failure, no partial-deletion state is persisted
   silently, and they can retry.
5. **Given** deletion has succeeded, **When** the same user signs in again,
   **Then** they see a fresh empty state (no phrasebooks, no entries) — as if they are a new
   user — without any residual data from the deleted account.

---

### User Story 2 — View Privacy Policy (Priority: P2)

A user (existing or prospective) wants to understand what personal data WordSprout collects,
how it is used, and what rights they have over it. They navigate to the Privacy Policy page
(accessible from the app footer and from account settings) and read a clear, human-readable
policy.

**Why this priority**: Displaying a Privacy Policy is a legal requirement in most jurisdictions
for any service that collects personal data. It must be accessible without signing in.

**Independent Test**: A user who is not signed in can navigate directly to the Privacy Policy
page and read the full policy text without any authentication barrier.

**Acceptance Scenarios**:

1. **Given** any visitor (authenticated or unauthenticated), **When** they navigate to the
   Privacy Policy URL, **Then** they can read the full Privacy Policy without being required
   to sign in.
2. **Given** a signed-in user, **When** they look for the Privacy Policy link in the app
   footer or account settings, **Then** they find a clearly labelled link that opens the
   Privacy Policy page.
3. **Given** the Privacy Policy page is open, **When** the user reads it, **Then** the policy
   covers: what data is collected, why it is collected, how it is stored, who it is shared with,
   how long it is kept, and how to exercise data rights including deletion.

---

### User Story 3 — View Terms and Conditions (Priority: P3)

A user wants to understand the rules governing their use of WordSprout, including their rights
over their own content, acceptable use rules, and the basis on which the service is provided.
They navigate to the Terms and Conditions page (accessible from the app footer and login screen).

**Why this priority**: T&C define the legal relationship between the user and the service
operator. Required for any public-facing service but informational in nature, making it lower
priority than the functional deletion feature.

**Independent Test**: A user who is not signed in can navigate directly to the Terms and
Conditions page and read the full T&C text without any authentication barrier.

**Acceptance Scenarios**:

1. **Given** any visitor (authenticated or unauthenticated), **When** they navigate to the
   Terms and Conditions URL, **Then** they can read the full T&C without being required to
   sign in.
2. **Given** the login screen is displayed, **When** the user looks at it, **Then** a link to
   the Terms and Conditions is visible before authentication.
3. **Given** the T&C page is open, **When** the user reads it, **Then** the document covers:
   service description, eligibility (minimum age), acceptable use, ownership of user content,
   AI feature disclaimers, service availability disclaimer, and termination/deletion rights.

---

### Edge Cases

- What happens if the server is unreachable when the user tries to delete their account?
  The deletion must not silently partially succeed; the user must be able to retry.
- What if the user's Microsoft Entra ID account is deleted externally (e.g., by an admin)
  before the user deletes their WordSprout account? The server-side data clean-up path
  must still be available (e.g., an admin purge mechanism or a next-sign-in-based clean-up).
- What if a user navigates to `/privacy` or `/terms` on a mobile device in offline mode?
  These pages must render from cache / bundled content since they are static.
- What if deletion is confirmed but only partially completes (cloud deleted, local not cleared,
  or vice versa)? The system should treat a partial delete as an error and guide the user to
  retry the full process.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Account Deletion

- **FR-001**: The app MUST provide an "Delete Account" action accessible from the account
  settings area when a user is signed in.
- **FR-002**: Before executing deletion, the system MUST display a confirmation dialog that
  explicitly names what will be deleted (phrasebooks, vocabulary entries, notes, learning
  progress, and account data) and states the action is permanent and irreversible.
- **FR-003**: The confirmation dialog MUST require an explicit affirmative action (e.g., a
  labelled confirm button) before proceeding; passive dismissal or accidental tap MUST NOT
  trigger deletion.
- **FR-004**: Upon confirmed deletion, the system MUST permanently delete all server-side
  records associated with the user: user profile, all phrasebooks, all vocabulary entries,
  all AI enrichments, and the allowlist record.
- **FR-005**: Upon confirmed deletion, the system MUST clear all locally stored data on the
  device (browser/app local storage and cached data).
- **FR-006**: After successful deletion, the user MUST be signed out and redirected to the
  login/home page.
- **FR-007**: If the server-side deletion fails (e.g., network error), the system MUST inform
  the user of the failure and MUST NOT sign them out or clear local data until deletion
  succeeds.
- **FR-008**: If a user who previously deleted their account signs in again, the system MUST
  treat them as a new user with no pre-existing data.
- **FR-009**: The deletion API endpoint MUST only accept requests from the authenticated
  account being deleted (i.e., a user cannot delete another user's account).

#### Privacy Policy Page

- **FR-010**: A Privacy Policy page MUST be accessible at a stable, public URL (e.g., `/privacy`).
- **FR-011**: The Privacy Policy page MUST be accessible without authentication.
- **FR-012**: The Privacy Policy page MUST be accessible from the app footer on all pages.
- **FR-013**: The Privacy Policy page MUST display the content defined in the
  "Privacy Policy Content" section of this specification.
- **FR-014**: The Privacy Policy page MUST render correctly in offline mode (content bundled
  or cached with the app).

#### Terms and Conditions Page

- **FR-015**: A Terms and Conditions page MUST be accessible at a stable, public URL
  (e.g., `/terms`).
- **FR-016**: The Terms and Conditions page MUST be accessible without authentication.
- **FR-017**: The Terms and Conditions page MUST be accessible from the app footer on all pages
  and from the login/sign-in screen.
- **FR-018**: The Terms and Conditions page MUST display the content defined in the
  "Terms and Conditions Content" section of this specification.
- **FR-019**: The Terms and Conditions page MUST render correctly in offline mode.

---

### Privacy Policy Content

The Privacy Policy page MUST display the following content. The operator MUST replace all
`[placeholder]` values before publishing.

---

**WordSprout — Privacy Policy**

*Last updated: April 2026*

**1. Who We Are**

WordSprout is a personal vocabulary phrasebook application that helps language learners capture,
organise, and review vocabulary encountered in everyday life. The service is operated by
[operator name / contact email].

**2. What Data We Collect**

We collect and process the following personal data when you use WordSprout:

| Data type | Description |
|-----------|-------------|
| Account information | Your email address and display name, received from Microsoft at sign-in. We do not receive or store your password. |
| Vocabulary data | Phrasebooks, vocabulary entries, translations, notes, tags, and part-of-speech labels that you create in the app. |
| Learning progress | Learning scores, review dates, and progress history associated with your vocabulary entries. |
| AI enrichment data | When you request AI-powered enrichment (e.g., example sentences, synonyms), the text of your vocabulary entry is sent to an AI processing service to generate the enrichment. This data is not retained by the AI provider beyond the duration of the request. |
| Usage quotas | A daily counter tracking your use of AI enrichment features, used to enforce fair-use limits. |

**3. Why We Collect Your Data**

We process your data to:

- Provide and operate the WordSprout vocabulary management service.
- Sync your vocabulary data across your devices.
- Deliver AI-powered enrichment features when you request them.
- Enforce fair-use limits on AI features.

The legal basis for processing is the performance of the service you have agreed to use (contractual basis).

**4. How We Store Your Data**

Your data is stored in two places:

- **On your device**: In your browser's local storage, enabling offline access to your vocabulary.
- **In the cloud**: On secure servers hosted on Microsoft Azure, enabling cross-device sync and backup.

**5. Who We Share Your Data With**

We do not sell or share your personal data with third parties for advertising or commercial purposes.

We use the following third-party service providers to operate WordSprout:

- **Microsoft Azure** – Cloud infrastructure and identity provider. Microsoft processes your data as a sub-processor in accordance with [Microsoft's Privacy Statement](https://privacy.microsoft.com/privacystatement).
- **Azure OpenAI Service** – AI-powered vocabulary enrichment. Your vocabulary entry text is transmitted to this service only when you explicitly request enrichment. The provider does not retain request data.

**6. How Long We Keep Your Data**

We retain your personal data for as long as your WordSprout account is active.

If you delete your account (see Section 7), all your personal data is permanently deleted from our cloud systems immediately, and you will be signed out. Local data stored on your device is also cleared at the time of deletion.

**7. Your Rights**

You have the following rights regarding your personal data:

- **Right of access**: You may request a summary of the personal data we hold about you.
- **Right to erasure**: You may permanently delete your account and all associated data at any time via the account settings in the app.
- **Right to rectification**: You may update or correct your vocabulary data at any time within the app.
- **Right to data portability**: You may request an export of your vocabulary data by contacting us.
- **Right to object**: You may object to processing by ceasing to use the service and deleting your account.

To exercise any right not available directly in the app, contact us at: [operator email address].

**8. Cookies and Local Storage**

WordSprout uses browser local storage and cookies only for essential functions: maintaining your authentication session and enabling offline access to your data. We do not use advertising, tracking, or analytics cookies.

**9. Children's Privacy**

WordSprout is not intended for users under the age of 16. We do not knowingly collect personal data from children. If you believe a child has provided us with data, please contact us so we can delete it.

**10. Changes to This Policy**

We may update this Privacy Policy from time to time. The "Last updated" date at the top of this page will reflect the most recent changes. Your continued use of WordSprout after a policy update constitutes acceptance of the revised policy.

**11. Contact**

For privacy-related enquiries or to exercise your data rights, contact: [operator email address]

---

### Terms and Conditions Content

The Terms and Conditions page MUST display the following content. The operator MUST replace all
`[placeholder]` values before publishing.

---

**WordSprout — Terms and Conditions**

*Last updated: April 2026*

**1. Acceptance of Terms**

By using WordSprout you agree to these Terms and Conditions ("Terms"). If you do not agree, please do not use the app.

**2. Description of Service**

WordSprout is a personal vocabulary phrasebook application that allows you to capture, organise, and review foreign language vocabulary. The service includes optional AI-powered features to enrich vocabulary entries. WordSprout is provided primarily for personal, non-commercial use.

**3. Eligibility**

You must be at least 16 years old to use WordSprout. By signing in you confirm that you meet this requirement. If you are under 16, you are not permitted to use the service.

**4. Access**

WordSprout is an invite-only service. Access is granted at the discretion of the service operator. The operator reserves the right to grant, suspend, or revoke access at any time, with or without notice.

**5. Your Content**

All vocabulary data you create in WordSprout — including phrasebooks, entries, translations, notes, and tags — remains your property. We do not claim any ownership over your content. You are solely responsible for the content you add to the app, including ensuring it does not violate any applicable laws.

**6. Acceptable Use**

You agree not to:

- Use WordSprout for any unlawful purpose or in violation of any applicable regulations.
- Attempt to reverse-engineer, decompile, or disrupt the service or its underlying infrastructure.
- Introduce malicious code, automated scripts, or bots that abuse the service or its AI features.
- Attempt to access another user's account or data.

**7. AI Features**

WordSprout provides optional AI-powered features (e.g., example sentences, synonyms) to enrich vocabulary entries. AI-generated content is provided for informational and educational purposes only. It may not always be accurate, complete, or appropriate. You are responsible for verifying AI-generated suggestions before relying on them.

Use of AI features is subject to fair-use limits. Exceeding daily limits will temporarily restrict AI feature access.

**8. Service Availability**

WordSprout is provided on a best-efforts basis. We do not guarantee uninterrupted availability, error-free operation, or that the service will meet your specific requirements. We may modify, suspend, or discontinue any part of the service at any time without prior notice.

**9. Limitation of Liability**

To the fullest extent permitted by applicable law, the operator of WordSprout is not liable for any direct, indirect, incidental, or consequential loss or damage arising from:

- Your use of, or inability to use, the service.
- Loss or corruption of vocabulary data.
- Reliance on AI-generated content.
- Unauthorised access to your data.

**10. Termination**

You may stop using WordSprout and delete your account at any time via the account settings in the app. The operator may terminate your access at any time if you violate these Terms.

Upon account deletion, all your personal data stored by WordSprout will be permanently erased as described in the Privacy Policy.

**11. Intellectual Property**

The WordSprout application, including its design, code, and branding, is owned by the service operator. Nothing in these Terms grants you any right to use the WordSprout name, logo, or intellectual property other than to use the service as intended.

**12. Changes to These Terms**

We may update these Terms from time to time. The "Last updated" date at the top reflects the most recent revision. Continued use of WordSprout after a change to these Terms constitutes your acceptance of the revised Terms.

**13. Governing Law**

These Terms are governed by and construed in accordance with the laws of [jurisdiction — e.g., England and Wales / the operator's jurisdiction]. Any disputes will be subject to the exclusive jurisdiction of the courts of [jurisdiction].

**14. Contact**

For enquiries regarding these Terms, contact: [operator email address]

---

### Key Entities *(data involved in account deletion)*

- **User**: Server-side profile record containing email address and AI quota counters. Must be
  deleted on account deletion.
- **AllowList**: Access control record containing the user's email and the date access was
  granted. Must be deleted on account deletion (contains personal data).
- **Phrasebook**: Language-pair collection container owned by the user. All phrasebooks for the
  user must be deleted.
- **VocabularyEntry**: Individual vocabulary item belonging to a phrasebook. All entries across
  all phrasebooks must be deleted.
- **AIEnrichment**: AI-generated content linked to a vocabulary entry. All enrichments for the
  user's entries must be deleted.
- **Local device data**: Cached/offline copies of all of the above, stored in the browser's
  local storage and IndexedDB. Must be cleared on account deletion.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who has phrasebooks and vocabulary entries can complete full account
  deletion in under 60 seconds from initiating the action.
- **SC-002**: After a confirmed deletion, zero records belonging to the deleted user are
  retrievable from the server. This is verifiable by an administrator query.
- **SC-003**: The Privacy Policy and Terms and Conditions pages load in offline mode without
  any network request (verified by disabling network in browser developer tools).
- **SC-004**: Both static pages (Privacy Policy and Terms and Conditions) are accessible at
  their public URLs without authentication, as verified by loading them in an incognito
  browser window.
- **SC-005**: No user successfully deletes another user's account data through the deletion
  endpoint (verified by authorisation test: sending a deletion request with a different
  user's token returns an authorisation error).
- **SC-006**: The deletion confirmation dialog receives zero accidental confirmations in
  usability review (i.e., the required explicit confirm action prevents misfire).

---

## Assumptions

- **Jurisdiction**: GDPR (EU/UK) is assumed as the applicable data protection framework,
  as it is the most comprehensive and widely applicable. The operator MUST review and
  update the `[jurisdiction]` placeholders in the Privacy Policy and T&C before publishing
  if operating under a different legal framework (e.g., CCPA for California, POPIA for
  South Africa).
- **Minimum age**: 16 is assumed as the minimum age in alignment with GDPR Article 8
  (default age of digital consent in the EU). The operator should adjust to 13 if operating
  under a jurisdiction that permits it (e.g., COPPA in the US).
- **Microsoft identity, not app identity**: WordSprout relies on Microsoft Entra ID for
  authentication. Account deletion removes all WordSprout app data but does NOT delete the
  user's Microsoft account. This is by design: the Microsoft account is external to this
  service.
- **No data export UI in this feature**: A "download my data" export feature is out of scope
  for this feature. The right to portability is acknowledged in the Privacy Policy and
  satisfied via a manual contact process for now.
- **Operator identity placeholder**: The operator's name and contact email appear as
  `[placeholder]` in both legal pages. These must be filled in before the feature is
  considered production-ready. The specification intentionally does not hard-code these as
  they are the operator's personal details.
- **Static page content is bundled**: Privacy Policy and T&C content is bundled with the
  frontend application so it remains available offline. Content updates require a new app
  deployment.
- **Allowlist record deletion**: Deleting a user's allowlist record means they would need to
  be re-invited to access the service if they sign in again. This is the correct behaviour
  for a full "right to erasure" request.
- **No admin-initiated deletion UI**: Admin-side bulk deletion or server-side cleanup for
  orphaned accounts (e.g., accounts whose Microsoft identity was deleted externally) is out
  of scope for this feature.
