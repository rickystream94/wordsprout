import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prioritiseForSession, filterAndSelectEntries, collectTags } from '../db';
import type { DBEntry } from '../db';
import type { PartOfSpeech } from '../../types/models';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const TODAY = '2026-05-17';
const YESTERDAY = '2026-05-16';

function makeEntry(id: string, lastReviewedDate: string | null, learningScore = 50): DBEntry {
  return {
    id,
    userId: 'user-1',
    phrasebookId: 'pb-1',
    sourceText: `word-${id}`,
    tags: [],
    learningScore,
    lastReviewedDate,
    decayBaseScore: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// ─── prioritiseForSession ─────────────────────────────────────────────────────

describe('prioritiseForSession', () => {
  it('returns up to size entries from a pool that are all fresh', () => {
    const pool = [
      makeEntry('a', null),
      makeEntry('b', YESTERDAY),
      makeEntry('c', null),
      makeEntry('d', YESTERDAY),
      makeEntry('e', null),
    ];
    const result = prioritiseForSession(pool, 3, TODAY);
    expect(result).toHaveLength(3);
    // All returned must be fresh (not reviewed today)
    for (const e of result) {
      expect(e.lastReviewedDate).not.toBe(TODAY);
    }
  });

  it('includes stale entries only when fresh pool is smaller than size', () => {
    const fresh = [makeEntry('f1', null), makeEntry('f2', YESTERDAY)];
    const stale = [makeEntry('s1', TODAY), makeEntry('s2', TODAY), makeEntry('s3', TODAY)];
    const pool = [...fresh, ...stale];

    const result = prioritiseForSession(pool, 4, TODAY);

    expect(result).toHaveLength(4);
    const freshInResult = result.filter((e) => e.lastReviewedDate !== TODAY);
    const staleInResult = result.filter((e) => e.lastReviewedDate === TODAY);
    // All fresh entries appear
    expect(freshInResult).toHaveLength(2);
    // Remaining 2 slots filled from stale
    expect(staleInResult).toHaveLength(2);
  });

  it('places all fresh entries before any stale entries', () => {
    const fresh = [makeEntry('f1', null), makeEntry('f2', null)];
    const stale = [makeEntry('s1', TODAY), makeEntry('s2', TODAY)];
    const pool = [...stale, ...fresh]; // interleaved order

    const result = prioritiseForSession(pool, 4, TODAY);

    expect(result).toHaveLength(4);
    // First two must be fresh, last two stale
    expect(result[0].lastReviewedDate).not.toBe(TODAY);
    expect(result[1].lastReviewedDate).not.toBe(TODAY);
    expect(result[2].lastReviewedDate).toBe(TODAY);
    expect(result[3].lastReviewedDate).toBe(TODAY);
  });

  it('returns only stale entries when pool has no fresh ones', () => {
    const pool = [makeEntry('s1', TODAY), makeEntry('s2', TODAY), makeEntry('s3', TODAY)];
    const result = prioritiseForSession(pool, 2, TODAY);

    expect(result).toHaveLength(2);
    for (const e of result) {
      expect(e.lastReviewedDate).toBe(TODAY);
    }
  });

  it('returns fewer than size entries when pool is too small', () => {
    const pool = [makeEntry('a', null), makeEntry('b', TODAY)];
    const result = prioritiseForSession(pool, 10, TODAY);
    expect(result).toHaveLength(2);
  });

  it('returns an empty array for an empty pool', () => {
    expect(prioritiseForSession([], 5, TODAY)).toEqual([]);
  });

  it('treats lastReviewedDate=null as fresh (never reviewed)', () => {
    const pool = [makeEntry('a', null), makeEntry('b', TODAY)];
    const result = prioritiseForSession(pool, 2, TODAY);
    // Fresh first
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });
});

// ─── Fixture helpers for pure-function tests ─────────────────────────────────

function makeDbEntry(overrides: Partial<DBEntry> & { id: string }): DBEntry {
  return {
    userId: 'user-1',
    phrasebookId: 'pb-1',
    sourceText: `word-${overrides.id}`,
    tags: [],
    learningScore: 50,
    lastReviewedDate: null,
    decayBaseScore: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── filterAndSelectEntries ───────────────────────────────────────────────────

describe('filterAndSelectEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns [] when pool is empty', () => {
    expect(filterAndSelectEntries([], 'random', 5, [], [])).toEqual([]);
  });

  it('returns up to size entries with no filters (random)', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'].map((id) => makeDbEntry({ id }));
    const result = filterAndSelectEntries(pool, 'random', 3, [], []);
    expect(result).toHaveLength(3);
  });

  it('returns entire pool when pool is smaller than size', () => {
    const pool = ['a', 'b'].map((id) => makeDbEntry({ id }));
    expect(filterAndSelectEntries(pool, 'random', 10, [], [])).toHaveLength(2);
  });

  it('filters by PoS — includes only matching entries', () => {
    const pool = [
      makeDbEntry({ id: 'n1', partOfSpeech: 'noun' }),
      makeDbEntry({ id: 'v1', partOfSpeech: 'verb' }),
      makeDbEntry({ id: 'n2', partOfSpeech: 'noun' }),
    ];
    const result = filterAndSelectEntries(pool, 'random', 10, ['noun'], []);
    expect(result.every((e) => e.partOfSpeech === 'noun')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('filters by PoS — excludes entries with no partOfSpeech', () => {
    const pool = [
      makeDbEntry({ id: 'n1', partOfSpeech: 'noun' }),
      makeDbEntry({ id: 'noPOS', partOfSpeech: undefined }),
    ];
    const result = filterAndSelectEntries(pool, 'random', 10, ['noun'], []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n1');
  });

  it('returns [] when PoS filter matches nothing', () => {
    const pool = [makeDbEntry({ id: 'v1', partOfSpeech: 'verb' })];
    expect(filterAndSelectEntries(pool, 'random', 10, ['noun'], [])).toEqual([]);
  });

  it('tag filter uses OR semantics — entry must have at least one matching tag', () => {
    const pool = [
      makeDbEntry({ id: 'a', tags: ['greetings', 'formal'] }),
      makeDbEntry({ id: 'b', tags: ['food'] }),
      makeDbEntry({ id: 'c', tags: ['travel'] }),
    ];
    const result = filterAndSelectEntries(pool, 'random', 10, [], ['greetings', 'food']);
    expect(result.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('combines PoS and tag filters with AND semantics', () => {
    const pool = [
      makeDbEntry({ id: 'match', partOfSpeech: 'noun', tags: ['food'] }),
      makeDbEntry({ id: 'wrongPOS', partOfSpeech: 'verb', tags: ['food'] }),
      makeDbEntry({ id: 'wrongTag', partOfSpeech: 'noun', tags: ['travel'] }),
    ];
    const result = filterAndSelectEntries(pool, 'random', 10, ['noun'], ['food']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('match');
  });

  it('targeted type returns entries sorted ascending by learningScore', () => {
    const pool = [
      makeDbEntry({ id: 'high', learningScore: 90 }),
      makeDbEntry({ id: 'low', learningScore: 10 }),
      makeDbEntry({ id: 'mid', learningScore: 50 }),
    ];
    const result = filterAndSelectEntries(pool, 'targeted', 3, [], []);
    expect(result.map((e) => e.id)).toEqual(['low', 'mid', 'high']);
  });

  it('targeted type with size limit returns lowest-score entries', () => {
    const pool = [
      makeDbEntry({ id: 'high', learningScore: 90 }),
      makeDbEntry({ id: 'low', learningScore: 10 }),
      makeDbEntry({ id: 'mid', learningScore: 50 }),
    ];
    const result = filterAndSelectEntries(pool, 'targeted', 2, [], []);
    expect(result.map((e) => e.id)).toEqual(['low', 'mid']);
  });

  it('does not mutate the input pool array', () => {
    const pool = [
      makeDbEntry({ id: 'a', learningScore: 80 }),
      makeDbEntry({ id: 'b', learningScore: 20 }),
    ];
    const originalIds = pool.map((e) => e.id);
    filterAndSelectEntries(pool, 'targeted', 2, [], []);
    // Original pool order should be unchanged
    expect(pool.map((e) => e.id)).toEqual(originalIds);
  });

  // T027: targeted type + posFilter combo
  it('targeted type with posFilter: returns lowest-score matching entries only', () => {
    const pool = [
      makeDbEntry({ id: 'noun-low', partOfSpeech: 'noun', learningScore: 10 }),
      makeDbEntry({ id: 'verb-low', partOfSpeech: 'verb', learningScore: 5 }),
      makeDbEntry({ id: 'noun-high', partOfSpeech: 'noun', learningScore: 80 }),
    ];
    const result = filterAndSelectEntries(pool, 'targeted', 2, ['noun' as PartOfSpeech], []);
    // Only noun entries: noun-low(10) and noun-high(80), sorted ascending → return both
    const resultIds = result.map((e) => e.id);
    expect(resultIds).toContain('noun-low');
    expect(resultIds).toContain('noun-high');
    expect(resultIds).not.toContain('verb-low');
    expect(result).toHaveLength(2);
  });
});

// ─── collectTags ──────────────────────────────────────────────────────────────

describe('collectTags', () => {
  it('returns sorted deduplicated tags from all entries', () => {
    const entries = [
      makeDbEntry({ id: 'a', tags: ['travel', 'formal'] }),
      makeDbEntry({ id: 'b', tags: ['food', 'travel'] }),
    ];
    expect(collectTags(entries)).toEqual(['food', 'formal', 'travel']);
  });

  it('returns [] when no entries have tags', () => {
    const entries = [makeDbEntry({ id: 'a', tags: [] }), makeDbEntry({ id: 'b', tags: [] })];
    expect(collectTags(entries)).toEqual([]);
  });

  it('returns [] for an empty entry array', () => {
    expect(collectTags([])).toEqual([]);
  });

  it('deduplicates tags appearing in multiple entries', () => {
    const entries = [
      makeDbEntry({ id: 'a', tags: ['food', 'travel'] }),
      makeDbEntry({ id: 'b', tags: ['food'] }),
    ];
    expect(collectTags(entries)).toEqual(['food', 'travel']);
  });
});

