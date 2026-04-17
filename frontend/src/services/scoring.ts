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

/** Strip punctuation, collapse whitespace, lowercase. Language-agnostic. */
export function normalize(text: string): string {
  return text
    .replace(/\p{P}/gu, '')
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

/**
 * Compare the user's input against the expected answer.
 * Returns 'correct' if exact (after normalize), 'typo' if within allowed
 * edit distance, 'wrong' otherwise.
 */
export function evaluateAnswer(input: string, answer: string): EvalResult {
  const normInput = normalize(input);
  const normAnswer = normalize(answer);

  if (normInput === normAnswer) return 'correct';

  const allowed = maxTypos(normAnswer);
  if (distance(normInput, normAnswer) <= allowed) return 'typo';

  return 'wrong';
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
