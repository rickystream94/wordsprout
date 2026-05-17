import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockMeta,
  mockEntries,
  mockEnqueuMutation,
} = vi.hoisted(() => {
  return {
    mockMeta: {
      get: vi.fn(async () => null as { key: string; value: string } | null | undefined),
      put: vi.fn(async () => undefined),
    },
    mockEntries: {
      where: vi.fn(),
      update: vi.fn(async () => 1),
    },
    mockEnqueuMutation: vi.fn(async () => undefined),
  };
});

vi.mock('../db', () => ({
  db: {
    meta: mockMeta,
    entries: mockEntries,
  },
}));

vi.mock('../sync', () => ({
  enqueueMutation: mockEnqueuMutation,
}));

import { applyDecayRound } from '../decay';
import { todayKey, graceForScore, DECAY_RATE_DAYS } from '../scoring';
import type { DBEntry } from '../db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('sv');
}

function makeEntry(overrides: Partial<DBEntry> = {}): DBEntry {
  return {
    id: 'entry-1',
    userId: 'user-1',
    phrasebookId: 'pb-1',
    sourceText: 'ciao',
    targetText: 'hello',
    tags: [],
    learningScore: 80,
    lastReviewedDate: daysAgo(graceForScore(80) + DECAY_RATE_DAYS), // just past grace (Engraved → 21 days)
    decayBaseScore: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── applyDecayRound ─────────────────────────────────────────────────────────

describe('applyDecayRound', () => {
  const USER_ID = 'user-1';
  const API_BASE = 'http://localhost:7071/api';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no previous decay today
    mockMeta.get.mockResolvedValue(null);
    // Default: entries query returns empty array
    mockEntries.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn(async () => [] as DBEntry[]),
      }),
    });
  });

  // ── Once-per-day guard ──────────────────────────────────────────────────────

  it('returns early without any writes when lastDecay equals today', async () => {
    mockMeta.get.mockResolvedValue({ key: 'lastDecay', value: todayKey() });

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockEntries.where).not.toHaveBeenCalled();
    expect(mockEntries.update).not.toHaveBeenCalled();
    expect(mockEnqueuMutation).not.toHaveBeenCalled();
    expect(mockMeta.put).not.toHaveBeenCalled();
  });

  it('proceeds with decay when lastDecay is a previous date', async () => {
    mockMeta.get.mockResolvedValue({ key: 'lastDecay', value: daysAgo(1) });

    await applyDecayRound(USER_ID, API_BASE);

    // Should have queried entries (proceeded past guard)
    expect(mockEntries.where).toHaveBeenCalled();
  });

  it('proceeds with decay when no lastDecay meta exists', async () => {
    mockMeta.get.mockResolvedValue(null);

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockEntries.where).toHaveBeenCalled();
  });

  // ── Skip conditions ─────────────────────────────────────────────────────────

  it('skips entries with learningScore === 0', async () => {
    const entry = makeEntry({ learningScore: 0 });
    mockEntries.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn(async () => [entry]) }),
    });

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockEntries.update).not.toHaveBeenCalled();
    expect(mockEnqueuMutation).not.toHaveBeenCalled();
  });

  it('skips entries with decayBaseScore === null', async () => {
    const entry = makeEntry({ decayBaseScore: null });
    mockEntries.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn(async () => [entry]) }),
    });

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockEntries.update).not.toHaveBeenCalled();
    expect(mockEnqueuMutation).not.toHaveBeenCalled();
  });

  it('skips entries with lastReviewedDate === null', async () => {
    const entry = makeEntry({ lastReviewedDate: null });
    mockEntries.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn(async () => [entry]) }),
    });

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockEntries.update).not.toHaveBeenCalled();
    expect(mockEnqueuMutation).not.toHaveBeenCalled();
  });

  it('skips entries still within the grace period', async () => {
    const entry = makeEntry({
      lastReviewedDate: daysAgo(graceForScore(80) - 1), // still in grace (Engraved → 21 days)
    });
    mockEntries.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn(async () => [entry]) }),
    });

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockEntries.update).not.toHaveBeenCalled();
    expect(mockEnqueuMutation).not.toHaveBeenCalled();
  });

  it('skips entries whose score is already at the computed target (no-op)', async () => {
    // Score is already at 79 and target for this elapsed time would also be 79
    const daysElapsed = graceForScore(80) + DECAY_RATE_DAYS; // 1 decay point
    const entry = makeEntry({
      learningScore: 79,
      decayBaseScore: 80,
      lastReviewedDate: daysAgo(daysElapsed),
    });
    mockEntries.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn(async () => [entry]) }),
    });

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockEntries.update).not.toHaveBeenCalled();
    expect(mockEnqueuMutation).not.toHaveBeenCalled();
  });

  // ── Decay writes ────────────────────────────────────────────────────────────

  it('updates IndexedDB with decayed score for eligible entry', async () => {
    const daysElapsed = graceForScore(80) + DECAY_RATE_DAYS; // 1 decay point
    const entry = makeEntry({
      learningScore: 80,
      decayBaseScore: 80,
      lastReviewedDate: daysAgo(daysElapsed),
    });
    mockEntries.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn(async () => [entry]) }),
    });

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockEntries.update).toHaveBeenCalledOnce();
    const [id, changes] = mockEntries.update.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(id).toBe('entry-1');
    expect(changes.learningScore).toBe(79);
    expect(typeof changes.updatedAt).toBe('string');
  });

  it('enqueues a PUT mutation for each decayed entry', async () => {
    const daysElapsed = graceForScore(80) + DECAY_RATE_DAYS;
    const entry = makeEntry({
      learningScore: 80,
      decayBaseScore: 80,
      lastReviewedDate: daysAgo(daysElapsed),
    });
    mockEntries.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn(async () => [entry]) }),
    });

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockEnqueuMutation).toHaveBeenCalledOnce();
    const [url, method, body] = mockEnqueuMutation.mock.calls[0] as unknown as [string, string, Record<string, unknown>];
    expect(url).toBe(`${API_BASE}/entries/entry-1`);
    expect(method).toBe('PUT');
    expect((body as Record<string, unknown>).learningScore).toBe(79);
  });

  it('only writes changed entries when some are in grace and some are not', async () => {
    const inGrace = makeEntry({
      id: 'entry-grace',
      learningScore: 90,
      decayBaseScore: 90,
      lastReviewedDate: daysAgo(graceForScore(90) - 1), // still within 21-day grace
    });
    const pastGrace = makeEntry({
      id: 'entry-past',
      learningScore: 80,
      decayBaseScore: 80,
      lastReviewedDate: daysAgo(graceForScore(80) + DECAY_RATE_DAYS), // past 21-day grace
    });
    mockEntries.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn(async () => [inGrace, pastGrace]) }),
    });

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockEntries.update).toHaveBeenCalledOnce();
    const [id] = mockEntries.update.mock.calls[0] as unknown as [string, unknown];
    expect(id).toBe('entry-past');
    expect(mockEnqueuMutation).toHaveBeenCalledOnce();
  });

  // ── Meta update ─────────────────────────────────────────────────────────────

  it('writes lastDecay meta key with today after the pass', async () => {
    await applyDecayRound(USER_ID, API_BASE);

    expect(mockMeta.put).toHaveBeenCalledOnce();
    expect(mockMeta.put).toHaveBeenCalledWith({ key: 'lastDecay', value: todayKey() });
  });

  it('writes lastDecay meta even when all entries are skipped', async () => {
    // All entries in grace period — no updates, but meta still written
    const entry = makeEntry({ lastReviewedDate: daysAgo(1) });
    mockEntries.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn(async () => [entry]) }),
    });

    await applyDecayRound(USER_ID, API_BASE);

    expect(mockMeta.put).toHaveBeenCalledWith({ key: 'lastDecay', value: todayKey() });
  });
});
