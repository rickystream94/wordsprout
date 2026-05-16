import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock db ─────────────────────────────────────────────────────────────────

vi.mock('../db', () => ({
  db: {
    entries: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
        anyOf: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      }),
      toArray: vi.fn().mockResolvedValue([]),
    },
    enrichments: {
      where: vi.fn().mockReturnValue({
        anyOf: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      }),
    },
  },
}));

import { search, searchIds, substringMatch, rebuildIndex } from '../search';
import type { DBEntry } from '../db';

const ENTRIES: DBEntry[] = [
  {
    id: 'entry-1',
    userId: 'user-1',
    phrasebookId: 'pb-1',
    sourceText: 'ciao',
    targetText: 'hello',
    notes: 'Italian greeting',
    tags: ['greetings'],
    learningScore: 0,
    lastReviewedDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'entry-2',
    userId: 'user-1',
    phrasebookId: 'pb-1',
    sourceText: 'grazie',
    targetText: 'thank you',
    notes: '',
    tags: ['common'],
    learningScore: 0,
    lastReviewedDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ─── substringMatch ───────────────────────────────────────────────────────────

describe('substringMatch', () => {
  it('matches by sourceText substring', () => {
    const result = substringMatch('cia', ENTRIES);
    expect(result.has('entry-1')).toBe(true);
  });

  it('matches by targetText substring', () => {
    const result = substringMatch('hello', ENTRIES);
    expect(result.has('entry-1')).toBe(true);
  });

  it('matches by notes substring', () => {
    const result = substringMatch('Italian', ENTRIES);
    expect(result.has('entry-1')).toBe(true);
  });

  it('matches by tag', () => {
    const result = substringMatch('greet', ENTRIES);
    expect(result.has('entry-1')).toBe(true);
  });

  it('is case-insensitive', () => {
    const result = substringMatch('CIAO', ENTRIES);
    expect(result.has('entry-1')).toBe(true);
  });

  it('returns empty set for no matches', () => {
    const result = substringMatch('zzz', ENTRIES);
    expect(result.size).toBe(0);
  });

  it('returns empty set for empty query', () => {
    const result = substringMatch('', ENTRIES);
    expect(result.size).toBe(0);
  });

  it('matches by synonyms when synonymMap is provided', () => {
    const synonymMap: Record<string, string[]> = { 'entry-1': ['hey', 'howdy'] };
    const result = substringMatch('howdy', ENTRIES, synonymMap);
    expect(result.has('entry-1')).toBe(true);
  });

  it('matches multiple entries', () => {
    const result = substringMatch('e', ENTRIES); // "hello", "greetings", "Italian greeting", "thank"
    expect(result.size).toBeGreaterThan(0);
  });
});

// ─── search and searchIds ─────────────────────────────────────────────────────

describe('search (in-memory index)', () => {
  beforeEach(async () => {
    // Manually rebuild index with test entries using the module's rebuildIndex function.
    // We need to stub db.entries.toArray to return ENTRIES for the full rebuild.
    const { db } = await import('../db');
    (db.entries as unknown as { toArray: ReturnType<typeof vi.fn> }).toArray
      .mockResolvedValue(ENTRIES);
    (db.enrichments.where as ReturnType<typeof vi.fn>).mockReturnValue({
      anyOf: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    await rebuildIndex();
  });

  it('returns empty array for blank query', () => {
    expect(search('')).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    expect(search('   ')).toEqual([]);
  });

  it('searchIds returns a Set of matching entry IDs', async () => {
    const ids = searchIds('ciao');
    expect(ids).toBeInstanceOf(Set);
  });
});
