import { distance } from 'fastest-levenshtein';

// ─── Constants ─────────────────────────────────────────────────────────────────

export const BASE_GAIN = 10;
export const LOSS = 5;
export const TYPO_FACTOR = 0.8;
export const MAX_SCORE = 100;
export const MIN_SCORE = 0;

// ─── Score range labels ────────────────────────────────────────────────────────

export type ScoreRange = 'dormant' | 'sprouting' | 'echoing' | 'inscribed' | 'engraved';

export function scoreToRange(score: number): ScoreRange {
  if (score <= 19) return 'dormant';
  if (score <= 39) return 'sprouting';
  if (score <= 59) return 'echoing';
  if (score <= 79) return 'inscribed';
  return 'engraved';
}

// ─── Text normalization ────────────────────────────────────────────────────────

/** Strip punctuation and symbols (Unicode General Categories P + S), collapse whitespace, lowercase. Language-agnostic — covers Latin, Arabic, CJK, Hebrew and all other scripts (FR-005, FR-006). */
export function normalize(text: string): string {
  return text
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ─── Grapheme segmentation ─────────────────────────────────────────────────────

/** Split a string into user-perceived characters (grapheme clusters). */
export function splitGraphemes(text: string): string[] {
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) {
    // Fallback: spread operator (works for BMP characters)
    return [...text];
  }
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return [...segmenter.segment(text)].map((s) => s.segment);
}

// ─── Typo tolerance ────────────────────────────────────────────────────────────

/** Maximum edit-distance errors allowed for a given normalized answer length. */
export function maxTypos(normalizedAnswer: string): number {
  const len = splitGraphemes(normalizedAnswer).length;
  return Math.max(1, Math.floor(len / 5));
}

// ─── Hint generation ───────────────────────────────────────────────────────────

/**
 * Returns a partially revealed version of the answer, showing the first
 * `revealCount` graphemes and replacing the rest with underscores.
 */
export function getHint(answer: string, revealCount: number): string {
  const graphemes = splitGraphemes(answer);
  return graphemes
    .map((g, i) => (g === ' ' ? ' ' : i < revealCount ? g : '_'))
    .join('');
}

// ─── Answer evaluation ─────────────────────────────────────────────────────────

export type EvalResult = 'correct' | 'typo' | 'wrong';

export interface EvalOutcome {
  result: EvalResult;
  /** true when the match was against a synonym rather than the primary targetText */
  isSynonymHit: boolean;
}

/**
 * Compare the user's input against one or more acceptable answers (primary + synonyms).
 * Exact matches are tried first across all answers, then typo matches.
 * Returns the best outcome found.
 */
export function evaluateAnswer(input: string, answers: string[]): EvalOutcome {
  const normInput = normalize(input);

  // Pass 1: exact match
  for (let i = 0; i < answers.length; i++) {
    if (normInput === normalize(answers[i])) {
      return { result: 'correct', isSynonymHit: i > 0 };
    }
  }

  // Pass 2: typo tolerance
  for (let i = 0; i < answers.length; i++) {
    const normAnswer = normalize(answers[i]);
    const allowed = maxTypos(normAnswer);
    if (distance(normInput, normAnswer) <= allowed) {
      return { result: 'typo', isSynonymHit: i > 0 };
    }
  }

  return { result: 'wrong', isSynonymHit: false };
}

// ─── Score delta computation ───────────────────────────────────────────────────

export interface ScoreOptions {
  result: EvalResult;
  hintsUsed: number;
  graphemeCount: number; // splitGraphemes(normalizedAnswer).length
}

/**
 * Compute how many points to add (or subtract) based on the answer result.
 * Returns a positive or negative integer.
 */
export function computeScoreDelta(opts: ScoreOptions): number {
  const { result, hintsUsed, graphemeCount } = opts;

  if (result === 'wrong') return -LOSS;

  const hintFactor = graphemeCount > 0
    ? Math.max(0, 1 - hintsUsed / graphemeCount)
    : 0;

  const typoMultiplier = result === 'typo' ? TYPO_FACTOR : 1;

  const rawGain = BASE_GAIN * hintFactor * typoMultiplier;

  if (rawGain <= 0) return 1; // always give at least 1 point for a correct answer
  return Math.max(1, Math.floor(rawGain));
}

// ─── Apply delta ───────────────────────────────────────────────────────────────

/** Clamp the new score to [MIN_SCORE, MAX_SCORE]. */
export function applyDelta(currentScore: number, delta: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, currentScore + delta));
}

// ─── Today's date key ──────────────────────────────────────────────────────────

/** Returns today's date as 'YYYY-MM-DD' in local time. */
export function todayKey(): string {
  return new Date().toLocaleDateString('sv');
}

// ─── Learning score decay ─────────────────────────────────────────────────────

/**
 * Flat override for the grace period (all score tiers).
 * When VITE_DECAY_GRACE_DAYS is set to a valid non-negative integer, it overrides
 * the per-score tier table — useful for local testing (e.g. VITE_DECAY_GRACE_DAYS=0).
 * When unset, null is returned and graceForScore() uses the tier table.
 */
const _GRACE_OVERRIDE: number | null = (() => {
  const v = parseInt(import.meta.env.VITE_DECAY_GRACE_DAYS ?? '', 10);
  return Number.isFinite(v) && v >= 0 ? v : null;
})();

/**
 * One decay point is removed per this many days of inactivity beyond the grace period.
 * Configurable via VITE_DECAY_RATE_DAYS; production default is 3.
 */
export const DECAY_RATE_DAYS: number = (() => {
  const v = parseInt(import.meta.env.VITE_DECAY_RATE_DAYS ?? '', 10);
  return Number.isFinite(v) && v >= 1 ? v : 3;
})();

/**
 * Returns the grace period (days) for a given score, using the per-tier table.
 * If VITE_DECAY_GRACE_DAYS is set, returns that flat value for all tiers instead.
 *
 * Tier table (default):
 *   0–19  Dormant   →  3 days
 *   20–39 Sprouting →  5 days
 *   40–59 Echoing   →  7 days
 *   60–79 Inscribed → 14 days
 *   80–100 Engraved → 21 days
 */
export function graceForScore(score: number): number {
  if (_GRACE_OVERRIDE !== null) return _GRACE_OVERRIDE;
  if (score <= 19) return 3;
  if (score <= 39) return 5;
  if (score <= 59) return 7;
  if (score <= 79) return 14;
  return 21;
}

/**
 * Compute the decayed score for a phrasebook entry.
 *
 * The formula is idempotent across devices: given the same `decayBaseScore`,
 * `lastReviewedDate`, and `today`, every device computes the same `targetScore`.
 * `newScore = min(currentScore, targetScore)` ensures decay never raises a score.
 *
 * Returns `currentScore` unchanged when:
 * - `currentScore` is already 0
 * - `decayBaseScore` is null (entry never reviewed)
 * - `lastReviewedDate` is null (entry never reviewed)
 * - fewer than graceForScore(decayBaseScore) days have elapsed since `lastReviewedDate`
 *
 * @param currentScore     Current learningScore (0–100)
 * @param decayBaseScore   Score at time of last review session (null = never reviewed)
 * @param lastReviewedDate 'YYYY-MM-DD' date of the last review, or null
 * @param today            'YYYY-MM-DD' representing the current date
 */
export function computeDecay(
  currentScore: number,
  decayBaseScore: number | null,
  lastReviewedDate: string | null,
  today: string,
): number {
  if (currentScore === 0) return 0;
  // Use == null to guard against both null and undefined (e.g. pre-field IndexedDB entries)
  if (decayBaseScore == null || lastReviewedDate == null) return currentScore;

  const reviewedMs = new Date(lastReviewedDate).getTime();
  const todayMs = new Date(today).getTime();
  const daysElapsed = Math.round((todayMs - reviewedMs) / 86_400_000);

  const grace = graceForScore(decayBaseScore);
  if (daysElapsed <= grace) return currentScore;

  const graceExpiredDays = daysElapsed - grace;
  const decayPoints = Math.floor(graceExpiredDays / DECAY_RATE_DAYS);
  const targetScore = Math.max(MIN_SCORE, decayBaseScore - decayPoints);
  return Math.min(currentScore, targetScore);
}

// ─── Decay status (for UI indicators) ────────────────────────────────────────

/**
 * The urgency level of active decay, derived from percentage of score lost.
 *   low    =  0–15%  of decayBaseScore lost  (amber)
 *   medium = 15–35%  of decayBaseScore lost  (orange)
 *   high   =   35%+  of decayBaseScore lost  (red)
 */
export type DecayUrgency = 'low' | 'medium' | 'high';

export type DecayStatus =
  | { kind: 'none' }                                                      // never reviewed
  | { kind: 'grace'; daysLeft: number }                                   // within grace period
  | { kind: 'decaying'; pointsLost: number; urgency: DecayUrgency };     // decay in progress

/**
 * Compute the display-ready decay status for an entry.
 *
 * - 'none':     entry has never been reviewed (no badge shown)
 * - 'grace':    reviewed, decay not yet started; shows days remaining in grace period
 * - 'decaying': grace expired; shows points lost so far and urgency level
 *
 * @param decayBaseScore   Score at time of last review (null = never reviewed)
 * @param currentScore     Current learningScore
 * @param lastReviewedDate 'YYYY-MM-DD' date of the last review, or null
 * @param today            'YYYY-MM-DD' representing the current date
 */
export function getDecayStatus(
  decayBaseScore: number | null,
  currentScore: number,
  lastReviewedDate: string | null,
  today: string,
): DecayStatus {
  // Use == null to guard against both null and undefined (e.g. pre-field IndexedDB entries)
  if (decayBaseScore == null || lastReviewedDate == null) return { kind: 'none' };

  const reviewedMs = new Date(lastReviewedDate).getTime();
  const todayMs = new Date(today).getTime();
  const daysElapsed = Math.round((todayMs - reviewedMs) / 86_400_000);

  const grace = graceForScore(decayBaseScore);

  if (daysElapsed <= grace) {
    return { kind: 'grace', daysLeft: grace - daysElapsed };
  }

  const pointsLost = Math.max(0, decayBaseScore - currentScore);
  // No points lost yet (score hasn't been written back after grace expired) —
  // treat the same as "not decaying" to avoid showing "↓ 0pts".
  if (pointsLost === 0) return { kind: 'none' };

  const lostPct = decayBaseScore > 0 ? (pointsLost / decayBaseScore) * 100 : 0;
  const urgency: DecayUrgency = lostPct >= 35 ? 'high' : lostPct >= 15 ? 'medium' : 'low';

  return { kind: 'decaying', pointsLost, urgency };
}
