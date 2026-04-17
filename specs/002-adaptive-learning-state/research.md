# Research: Adaptive Learning State & Redesigned Review Sessions

**Phase 0 output** | Branch: `002-adaptive-learning-state` | Date: 2026-04-17

---

## R-01: Typo Tolerance Algorithm

**Question**: Which algorithm provides language-agnostic, Unicode-safe edit-distance comparison suitable for short vocabulary strings across any script?

**Decision**: Levenshtein edit distance (character-level), implemented by `fastest-levenshtein` npm package.

**Rationale**:
- Operates on Unicode code points — works identically for Latin, Cyrillic, Arabic, Chinese, Japanese, Hebrew, etc.
- No language-specific tokenisation or stemming; purely character-level.
- `fastest-levenshtein` is a zero-dependency TypeScript library (~1.2 KB minified+gzipped) with WASM acceleration on supported runtimes. It has no runtime cost on the API side since scoring is client-only.
- The tolerance formula — `floor(normalizedLength / 5)`, minimum 1 — maps cleanly to Levenshtein distance thresholds: if `editDistance <= threshold`, the answer is "close enough".

**Alternatives considered**:
- **Jaro-Winkler**: Better for names; less intuitive threshold mapping for vocabulary strings; not Unicode-guaranteed in all implementations. Rejected.
- **Damerau-Levenshtein** (transpositions): Adds "ab" → "ba" as 1 edit. Marginally more user-friendly but adds complexity; Levenshtein already tolerates transpositions in 2 edits (within threshold for words of 10+ chars). Acceptable approximation. Rejected for simplicity.
- **Simple contains / startsWith**: Does not handle middle-word typos. Rejected.

---

## R-02: Unicode-Aware, Language-Agnostic Text Normalisation

**Question**: How should punctuation, spacing, and case be stripped uniformly across all supported languages without breaking ideographic or RTL scripts?

**Decision**: Use a two-step pipeline: (1) Unicode `\p{P}` category regex to strip punctuation + explicitly strip hyphens and dashes (`-`, `–`, `—`); (2) `toLowerCase()` via the JS runtime (locale-agnostic for comparison purposes); (3) collapse whitespace and trim.

**Rationale**:
- The Unicode property escape `\p{P}` (punctuation) covers Latin, Arabic, CJK, Hebrew punctuation marks uniformly without enumeration. Supported in V8 (Chrome, Node 10+), JavaScriptCore (Safari 12+), SpiderMonkey (Firefox 78+) — all target platforms.
- CJK ideographs have no "lowercase"; `toLowerCase()` is a no-op for those characters, so the call is safe universally.
- Dashes (`-`, `–`, `—`) are in the "Pd" (dash punctuation) sub-category and are covered by `\p{P}`. No separate step needed.
- Numbers and currency symbols (`\p{N}`, `\p{Sc}`) are explicitly **not** stripped — preserving "H₂O" and "C#" semantics (per spec edge case).

**Alternatives considered**:
- ASCII punctuation enumeration (`[^\w\s]`): Fails for Arabic kashida, Hebrew maqaf, CJK brackets. Rejected.
- ICU / full Unicode normalisation (NFC/NFD): Normalises combining diacritics — useful but out of scope. The scoring algorithm does not need canonical decomposition. Deferred.

---

## R-03: Hint Reveal Strategy for Arbitrary Scripts

**Question**: How should the hint system reveal "one character" for scripts that don't tokenise into discrete grapheme clusters the same way Latin does (e.g., Arabic ligatures, Korean syllable blocks)?

**Decision**: Use `Intl.Segmenter` with `granularity: 'grapheme'` to split the normalised answer into segments. Each "hint" reveals one grapheme cluster (one segment). This treats Korean "가" as one unit, Arabic "ﻛ" as one unit, etc.

**Rationale**:
- `Intl.Segmenter` is the ECMA-402 standard API for Unicode grapheme segmentation. Supported in V8 109+ (Chrome 109, Node 18+), JavaScriptCore (Safari 15.4+), SpiderMonkey (Firefox 125+).
- Reveals semantically correct units for any script the user's phone or browser font can display.
- The `hint_factor` formula uses `normalizedAnswerLength` defined as the **number of grapheme segments** (not byte length) — consistent with what the user perceives as "characters".

**Alternatives considered**:
- JavaScript string `.length` (UTF-16 code units): Counts surrogate pairs incorrectly for emoji and some CJK extension characters. Rejected.
- Splitting on `[...string]` (Unicode codepoints): Better than UTF-16 but still splits combining character sequences. Rejected in favour of grapheme clusters.

---

## R-04: Offline Score Persistence Strategy

**Question**: Should score updates be written to IndexedDB synchronously within the flashcard evaluation, or enqueued asynchronously?

**Decision**: Write to IndexedDB synchronously (within `await` before rendering next card), then enqueue to `pendingSync` for server replication — using the existing `enqueueMutation` pattern.

**Rationale**:
- IndexedDB writes via Dexie are fast (<5 ms for a single row update). Awaiting the write before advancing ensures SC-002 ("progress retained on exit") is deterministic.
- Dexie `liveQuery` on the `entries` table will reactively update the `LearningScoreBar` (SC-004) without any additional event propagation.
- The `pendingSync` queue (already built in `frontend/src/services/sync.ts`) handles network-off scenarios; a `PATCH /entries/:id` mutation with `{ learningScore, lastReviewedDate }` is enqueued per card evaluation.
- No new sync infrastructure needed.

**Alternatives considered**:
- Fire-and-forget (write without await): Risks losing the last card's score if the user exits immediately. Rejected.
- Batching all session updates on session close: Violates FR-014 (persist per flashcard). Rejected.

---

## R-05: Daily Review Limit Boundary

**Question**: "Calendar day" — client clock vs. server clock, and which time zone?

**Decision**: Use the user's local device time zone for the midnight boundary. Store `lastReviewedDate` as a plain ISO 8601 date string (`YYYY-MM-DD`) in local time.

**Rationale**:
- Consistent with the spec assumption ("midnight, user's local time zone").
- Storing `YYYY-MM-DD` (not a timestamp) means comparison is `lastReviewedDate === today` where `today = new Date().toLocaleDateString('sv')` (ISO format, locale-independent). Compact and unambiguous.
- Server does not impose a time zone; `lastReviewedDate` in Cosmos DB is stored as the same `YYYY-MM-DD` string. If the server ever needs to audit this, the field is human-readable.
- The "device clock drift" edge case (spec): If the device clock is wrong by <12 hours, the worst case is the user gets one extra (or blocked) review. Acceptable for a personal app; no cryptographic-grade clock needed.

**Alternatives considered**:
- Store a full UTC timestamp and compute server-side: Requires an API round-trip before each card evaluation, breaking offline-first. Rejected.
- UTC midnight: Penalises users in UTC+X time zones who practice in the evening. Rejected.

---

## R-06: Dexie Schema Migration (version 1 → 2)

**Question**: How to migrate `learningState: LearningState` to `learningScore: number` in IndexedDB without data loss, and update Dexie's index definitions?

**Decision**: Add a Dexie `version(2)` block with an `upgrade` function that reads all `entries`, computes the new score via the mapping (`new` → 0, `learning` → 30, `mastered` → 90), writes back `learningScore` and `lastReviewedDate: null`, and removes the old `learningState` field. The index on `learningState` is replaced by an index on `learningScore`.

**Rationale**:
- Dexie's `version(n).upgrade(tx => ...)` API runs exactly once per database per user's browser, atomically. Existing data is preserved.
- The score mapping values (0, 30, 90) are the FR-020 mandated values.
- `lastReviewedDate` is initialised to `null` (never reviewed under the new system).
- No data loss: old `learningState` string is read and translated, then the field is removed from the stored object.

**Alternatives considered**:
- Keep both `learningState` and `learningScore`: Dual-state is a permanent maintenance burden and violates YAGNI. Rejected.
- New database version without migration: Wipes all local data. Rejected.

---

## R-07: Scoring Parameter Calibration

**Question**: Are the spec-mandated values (+10 gain, −5 loss, 80% typo factor, hint proportional factor) internally consistent and do they produce sensible progression curves?

**Analysis**:
- **To reach Mastered (80 pts) from 0**: 8 consecutive perfect correct answers. With a 50% hint factor, ~16 sessions. With maximum typo penalty (80%), ~10 sessions. Reasonable for spaced practice.
- **Mastered entry degrading to Learning (<80) after incorrect answers**: 4 consecutive misses from 80 pts. Provides meaningful risk.
- **Entry floor protection**: min 0 prevents demoralisation for very weak entries.
- **Asymmetry (+10 / −5)**: Net gain from a correct + incorrect pair is +5. Learners slowly improve even with mistakes — motivating.
- **Hint factor at 1-char answer** (e.g., "A"): `hint_factor = 1 – 1/1 = 0` → gain is 1 (minimum positive). Prevents cheating single-character entries.

**Decision**: Parameters are internally consistent. No adjustment needed.

---

## R-08: Session Flashcard Ordering

**Question**: Within a Random or Targeted session, should cards be ordered randomly or by some priority (e.g., lowest score first in Targeted)?

**Decision**:
- **Random session**: Fisher-Yates shuffle of all eligible entries, no ordering by score.
- **Targeted session**: Sort ascending by `learningScore` (weakest first), then shuffle equally-scored entries.

**Rationale**:
- Weakest-first in Targeted ensures the most critical vocabulary appears early — useful if users exit before completing the session (FR-014).
- Random sessions are meant to be genuinely random for variety, not optimized.

**Alternatives considered**:
- Purely random in both session types: Targeted would lose its "focused on weakest" intent. Rejected.
- Interleaved weak/strong in Targeted: Adds complexity for unclear benefit. Rejected.
