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
