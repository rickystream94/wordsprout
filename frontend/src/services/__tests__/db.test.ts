import { describe, it, expect } from 'vitest';
import { prioritiseForSession } from '../db';
import type { DBEntry } from '../db';

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
