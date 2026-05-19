import { describe, it, expect } from 'vitest';
import {
  scoreToRange,
  normalize,
  splitGraphemes,
  maxTypos,
  getHint,
  evaluateAnswer,
  computeScoreDelta,
  applyDelta,
  todayKey,
  computeDecay,
  graceForScore,
  getDecayStatus,
  DECAY_RATE_DAYS,
  BASE_GAIN,
  LOSS,
  MAX_SCORE,
  MIN_SCORE,
} from '../scoring';

// ─── scoreToRange ─────────────────────────────────────────────────────────────

describe('scoreToRange', () => {
  it('returns "dormant" for score 0', () => expect(scoreToRange(0)).toBe('dormant'));
  it('returns "dormant" for score 19', () => expect(scoreToRange(19)).toBe('dormant'));
  it('returns "sprouting" for score 20', () => expect(scoreToRange(20)).toBe('sprouting'));
  it('returns "sprouting" for score 39', () => expect(scoreToRange(39)).toBe('sprouting'));
  it('returns "echoing" for score 40', () => expect(scoreToRange(40)).toBe('echoing'));
  it('returns "echoing" for score 59', () => expect(scoreToRange(59)).toBe('echoing'));
  it('returns "inscribed" for score 60', () => expect(scoreToRange(60)).toBe('inscribed'));
  it('returns "inscribed" for score 79', () => expect(scoreToRange(79)).toBe('inscribed'));
  it('returns "engraved" for score 80', () => expect(scoreToRange(80)).toBe('engraved'));
  it('returns "engraved" for score 100', () => expect(scoreToRange(100)).toBe('engraved'));
});

// ─── normalize ────────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('lowercases the text', () => {
    expect(normalize('Hello')).toBe('hello');
  });

  it('trims whitespace', () => {
    expect(normalize('  ciao  ')).toBe('ciao');
  });

  it('collapses multiple spaces', () => {
    expect(normalize('ciao   mondo')).toBe('ciao mondo');
  });

  it('strips punctuation', () => {
    expect(normalize('hello!')).toBe('hello');
    expect(normalize('it\'s fine')).toBe('its fine');
  });

  it('handles empty string', () => {
    expect(normalize('')).toBe('');
  });

  it('handles Unicode punctuation', () => {
    expect(normalize('café!')).toBe('café');
  });
});

// ─── splitGraphemes ──────────────────────────────────────────────────────────

describe('splitGraphemes', () => {
  it('splits ASCII string into individual characters', () => {
    expect(splitGraphemes('abc')).toEqual(['a', 'b', 'c']);
  });

  it('counts emoji as single grapheme', () => {
    const result = splitGraphemes('👋');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('👋');
  });

  it('handles empty string', () => {
    expect(splitGraphemes('')).toEqual([]);
  });
});

// ─── maxTypos ─────────────────────────────────────────────────────────────────

describe('maxTypos', () => {
  it('returns 1 for short answers (< 5 chars)', () => {
    expect(maxTypos('hi')).toBe(1);
    expect(maxTypos('four')).toBe(1);
  });

  it('returns floor(len / 5) for longer answers', () => {
    expect(maxTypos('hello world')).toBe(Math.max(1, Math.floor(11 / 5)));
  });

  it('always returns at least 1', () => {
    expect(maxTypos('a')).toBeGreaterThanOrEqual(1);
  });
});

// ─── getHint ──────────────────────────────────────────────────────────────────

describe('getHint', () => {
  it('reveals first N characters', () => {
    expect(getHint('ciao', 2)).toBe('ci__');
  });

  it('preserves spaces regardless of reveal count', () => {
    expect(getHint('ciao mondo', 1)).toBe('c___ _____');
  });

  it('reveals all characters when revealCount >= length', () => {
    expect(getHint('ciao', 10)).toBe('ciao');
  });

  it('reveals nothing when revealCount is 0', () => {
    expect(getHint('ciao', 0)).toBe('____');
  });
});

// ─── evaluateAnswer ──────────────────────────────────────────────────────────

describe('evaluateAnswer', () => {
  it('returns "correct" for an exact match', () => {
    const result = evaluateAnswer('hello', ['hello']);
    expect(result.result).toBe('correct');
    expect(result.isSynonymHit).toBe(false);
  });

  it('is case-insensitive', () => {
    const result = evaluateAnswer('HELLO', ['hello']);
    expect(result.result).toBe('correct');
  });

  it('ignores punctuation in comparison', () => {
    const result = evaluateAnswer('hello!', ['hello']);
    expect(result.result).toBe('correct');
  });

  it('returns "typo" for near-miss within edit distance', () => {
    // "helo" vs "hello" — 1 edit, within tolerance for 5-char word (maxTypos=1)
    const result = evaluateAnswer('helo', ['hello']);
    expect(result.result).toBe('typo');
  });

  it('returns "wrong" when edit distance exceeds threshold', () => {
    const result = evaluateAnswer('xyz', ['hello']);
    expect(result.result).toBe('wrong');
  });

  it('matches against synonyms (second answer) and marks isSynonymHit', () => {
    const result = evaluateAnswer('hi', ['hello', 'hi']);
    expect(result.result).toBe('correct');
    expect(result.isSynonymHit).toBe(true);
  });

  it('prefers primary answer over synonym for exact match', () => {
    const result = evaluateAnswer('hello', ['hello', 'hi']);
    expect(result.isSynonymHit).toBe(false);
  });

  it('returns "wrong" with no synonym hit when nothing matches', () => {
    const result = evaluateAnswer('xyz', ['hello', 'hi']);
    expect(result.result).toBe('wrong');
    expect(result.isSynonymHit).toBe(false);
  });
});

// ─── computeScoreDelta ────────────────────────────────────────────────────────

describe('computeScoreDelta', () => {
  it('returns negative LOSS for "wrong" result', () => {
    expect(computeScoreDelta({ result: 'wrong', hintsUsed: 0, graphemeCount: 5 })).toBe(-LOSS);
  });

  it('returns positive points for "correct" with no hints', () => {
    const delta = computeScoreDelta({ result: 'correct', hintsUsed: 0, graphemeCount: 5 });
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBe(BASE_GAIN);
  });

  it('reduces gain when hints are used', () => {
    const noHints = computeScoreDelta({ result: 'correct', hintsUsed: 0, graphemeCount: 4 });
    const withHints = computeScoreDelta({ result: 'correct', hintsUsed: 2, graphemeCount: 4 });
    expect(withHints).toBeLessThan(noHints);
  });

  it('applies TYPO_FACTOR for "typo" result', () => {
    const typo = computeScoreDelta({ result: 'typo', hintsUsed: 0, graphemeCount: 5 });
    const correct = computeScoreDelta({ result: 'correct', hintsUsed: 0, graphemeCount: 5 });
    expect(typo).toBeLessThan(correct);
    expect(typo).toBeGreaterThan(0);
  });

  it('returns at least 1 for correct answers even with all hints revealed', () => {
    const delta = computeScoreDelta({ result: 'correct', hintsUsed: 10, graphemeCount: 5 });
    expect(delta).toBeGreaterThanOrEqual(1);
  });
});

// ─── applyDelta ───────────────────────────────────────────────────────────────

describe('applyDelta', () => {
  it('adds delta to current score', () => {
    expect(applyDelta(50, 10)).toBe(60);
  });

  it('subtracts delta for negative values', () => {
    expect(applyDelta(50, -5)).toBe(45);
  });

  it('clamps to MAX_SCORE (100)', () => {
    expect(applyDelta(95, 10)).toBe(MAX_SCORE);
  });

  it('clamps to MIN_SCORE (0)', () => {
    expect(applyDelta(3, -10)).toBe(MIN_SCORE);
  });

  it('allows score to remain at MIN_SCORE', () => {
    expect(applyDelta(0, -5)).toBe(MIN_SCORE);
  });
});

// ─── todayKey ─────────────────────────────────────────────────────────────────

describe('todayKey', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    const key = todayKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns today\'s date', () => {
    const key = todayKey();
    const today = new Date().toLocaleDateString('sv');
    expect(key).toBe(today);
  });
});

// ─── computeDecay ─────────────────────────────────────────────────────────────

/** Helper: returns a date string N days before today */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('sv');
}

describe('computeDecay', () => {
  const today = todayKey();
  // Tests use decayBaseScore = 80 (Engraved tier → grace = 21 days) unless noted

  it('returns currentScore unchanged when within the grace period (exactly grace days)', () => {
    expect(computeDecay(80, 80, daysAgo(graceForScore(80)), today)).toBe(80);
  });

  it('returns currentScore unchanged when less than grace days elapsed', () => {
    expect(computeDecay(80, 80, daysAgo(graceForScore(80) - 1), today)).toBe(80);
  });

  it('returns currentScore unchanged on the day after grace ends if DECAY_RATE_DAYS > 1', () => {
    // grace + 1 day elapsed → graceExpiredDays = 1 → floor(1 / RATE) = 0 if RATE > 1
    if (DECAY_RATE_DAYS > 1) {
      expect(computeDecay(80, 80, daysAgo(graceForScore(80) + 1), today)).toBe(80);
    }
  });

  it('decays by 1 point after grace + DECAY_RATE_DAYS days elapsed', () => {
    const daysElapsed = graceForScore(80) + DECAY_RATE_DAYS;
    const result = computeDecay(80, 80, daysAgo(daysElapsed), today);
    expect(result).toBe(79);
  });

  it('decays by 2 points after grace + 2*DECAY_RATE_DAYS days elapsed', () => {
    const daysElapsed = graceForScore(80) + 2 * DECAY_RATE_DAYS;
    const result = computeDecay(80, 80, daysAgo(daysElapsed), today);
    expect(result).toBe(78);
  });

  it('uses floor division (partial extra days do not add decay points)', () => {
    // grace + RATE + 1 → graceExpiredDays = RATE + 1 → floor((RATE+1)/RATE) = 1
    const daysElapsed = graceForScore(80) + DECAY_RATE_DAYS + 1;
    const result = computeDecay(80, 80, daysAgo(daysElapsed), today);
    expect(result).toBe(79);
  });

  it('clamps targetScore to MIN_SCORE (0) and never goes negative', () => {
    // Far future: massive decay
    expect(computeDecay(100, 100, daysAgo(10_000), today)).toBe(MIN_SCORE);
  });

  it('returns 0 immediately when currentScore is already 0', () => {
    expect(computeDecay(0, 80, daysAgo(graceForScore(80) + DECAY_RATE_DAYS), today)).toBe(0);
  });

  it('returns currentScore unchanged when decayBaseScore is null', () => {
    expect(computeDecay(80, null, daysAgo(graceForScore(80) + DECAY_RATE_DAYS), today)).toBe(80);
  });

  it('returns currentScore unchanged when lastReviewedDate is null', () => {
    expect(computeDecay(80, 80, null, today)).toBe(80);
  });

  it('is idempotent: if currentScore already equals targetScore, result is unchanged', () => {
    const daysElapsed = graceForScore(80) + DECAY_RATE_DAYS;
    const firstPass = computeDecay(80, 80, daysAgo(daysElapsed), today);
    // Second pass: currentScore already equals targetScore — should not decay further
    const secondPass = computeDecay(firstPass, 80, daysAgo(daysElapsed), today);
    expect(secondPass).toBe(firstPass);
  });

  it('never raises a score (decay cannot increase learningScore)', () => {
    // currentScore is lower than targetScore — should NOT increase
    const lowScore = 40;
    const highBase = 80;
    const result = computeDecay(lowScore, highBase, daysAgo(0), today); // within grace
    expect(result).toBeLessThanOrEqual(lowScore);
  });

  it('uses decayBaseScore as the anchor, not currentScore', () => {
    // currentScore = 90 (recovered), decayBaseScore = 100
    // After 5 decay ticks, target = max(0, 100-5) = 95; newScore = min(90, 95) = 90
    // currentScore (90) wins because it is already below the target (95)
    const daysElapsed = graceForScore(100) + 5 * DECAY_RATE_DAYS;
    const result = computeDecay(90, 100, daysAgo(daysElapsed), today);
    // Verify the formula: target = max(0, 100 - 5) = 95; min(90, 95) = 90
    expect(result).toBe(Math.min(90, Math.max(MIN_SCORE, 100 - 5)));
    expect(result).toBe(90); // currentScore is already below target — no change
  });

  it('exported DECAY_RATE_DAYS is a positive integer', () => {
    expect(Number.isInteger(DECAY_RATE_DAYS)).toBe(true);
    expect(DECAY_RATE_DAYS).toBeGreaterThanOrEqual(1);
  });
});

// ─── graceForScore ────────────────────────────────────────────────────────────

describe('graceForScore', () => {
  it('returns 3 for score 0 (Dormant)', () => expect(graceForScore(0)).toBe(3));
  it('returns 3 for score 19 (Dormant boundary)', () => expect(graceForScore(19)).toBe(3));
  it('returns 5 for score 20 (Sprouting)', () => expect(graceForScore(20)).toBe(5));
  it('returns 5 for score 39 (Sprouting boundary)', () => expect(graceForScore(39)).toBe(5));
  it('returns 7 for score 40 (Echoing)', () => expect(graceForScore(40)).toBe(7));
  it('returns 7 for score 59 (Echoing boundary)', () => expect(graceForScore(59)).toBe(7));
  it('returns 14 for score 60 (Inscribed)', () => expect(graceForScore(60)).toBe(14));
  it('returns 14 for score 79 (Inscribed boundary)', () => expect(graceForScore(79)).toBe(14));
  it('returns 21 for score 80 (Engraved)', () => expect(graceForScore(80)).toBe(21));
  it('returns 21 for score 100 (Engraved max)', () => expect(graceForScore(100)).toBe(21));
});

// ─── getDecayStatus ───────────────────────────────────────────────────────────

describe('getDecayStatus', () => {
  const today = todayKey();

  it('returns none when decayBaseScore is null', () => {
    expect(getDecayStatus(null, 80, daysAgo(10), today)).toEqual({ kind: 'none' });
  });

  it('returns none when lastReviewedDate is null', () => {
    expect(getDecayStatus(80, 80, null, today)).toEqual({ kind: 'none' });
  });

  it('returns grace with correct daysLeft when within grace period', () => {
    // decayBaseScore = 80 → grace = 21 days; reviewed 10 days ago → 11 days left
    const status = getDecayStatus(80, 80, daysAgo(10), today);
    expect(status).toEqual({ kind: 'grace', daysLeft: 11 });
  });

  it('returns grace with daysLeft = 0 on last day of grace period', () => {
    const grace = graceForScore(80); // 21
    const status = getDecayStatus(80, 80, daysAgo(grace), today);
    expect(status).toEqual({ kind: 'grace', daysLeft: 0 });
  });

  it('returns decaying with low urgency when <15% of base score lost', () => {
    // base = 100, current = 90 → lost 10 → 10% → low
    const daysElapsed = graceForScore(100) + 10 * DECAY_RATE_DAYS;
    const status = getDecayStatus(100, 90, daysAgo(daysElapsed), today);
    expect(status).toEqual({ kind: 'decaying', pointsLost: 10, urgency: 'low' });
  });

  it('returns decaying with medium urgency when 15–35% of base score lost', () => {
    // base = 100, current = 80 → lost 20 → 20% → medium
    const daysElapsed = graceForScore(100) + 20 * DECAY_RATE_DAYS;
    const status = getDecayStatus(100, 80, daysAgo(daysElapsed), today);
    expect(status).toEqual({ kind: 'decaying', pointsLost: 20, urgency: 'medium' });
  });

  it('returns decaying with high urgency when ≥35% of base score lost', () => {
    // base = 100, current = 60 → lost 40 → 40% → high
    const daysElapsed = graceForScore(100) + 40 * DECAY_RATE_DAYS;
    const status = getDecayStatus(100, 60, daysAgo(daysElapsed), today);
    expect(status).toEqual({ kind: 'decaying', pointsLost: 40, urgency: 'high' });
  });

  it('urgency boundary: exactly 15% is medium', () => {
    // base = 100, lost = 15 → exactly 15% → medium
    const status = getDecayStatus(100, 85, daysAgo(graceForScore(100) + 1), today);
    expect(status.kind).toBe('decaying');
    if (status.kind === 'decaying') {
      expect(status.pointsLost).toBe(15);
      expect(status.urgency).toBe('medium');
    }
  });

  it('urgency boundary: exactly 35% is high', () => {
    // base = 100, lost = 35 → exactly 35% → high
    const status = getDecayStatus(100, 65, daysAgo(graceForScore(100) + 1), today);
    expect(status.kind).toBe('decaying');
    if (status.kind === 'decaying') {
      expect(status.pointsLost).toBe(35);
      expect(status.urgency).toBe('high');
    }
  });

  it('returns grace with daysLeft 0 when past grace but pointsLost is 0 (score not yet written back)', () => {
    // Entry is past grace but learningScore still equals decayBaseScore —
    // applyDecayRound hasn’t fired yet (DECAY_RATE_DAYS > 1).
    // Expect a “gracer expired, decay pending” signal rather than hidden badge.
    const daysElapsed = graceForScore(80) + 5;
    const status = getDecayStatus(80, 80, daysAgo(daysElapsed), today);
    expect(status).toEqual({ kind: 'grace', daysLeft: 0 });
  });
});
