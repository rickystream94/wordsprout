import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockUpdateEntry, mockEnqueueMutation, mockUseLiveQuery } = vi.hoisted(() => ({
  mockUpdateEntry: vi.fn(async () => undefined),
  mockEnqueueMutation: vi.fn(async () => undefined),
  mockUseLiveQuery: vi.fn(() => []),
}));

vi.mock('../../../services/db', () => ({
  db: {
    enrichments: { where: vi.fn(() => ({ anyOf: vi.fn(() => ({ toArray: vi.fn(async () => []) })) })) },
    // Default: entry not reviewed today — live-read guard allows writes to proceed.
    entries: { get: vi.fn(async () => ({ lastReviewedDate: null })) },
  },
  updateEntry: mockUpdateEntry,
}));

vi.mock('../../../services/sync', () => ({
  enqueueMutation: mockEnqueueMutation,
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: mockUseLiveQuery,
}));

vi.mock('../FlashcardSession.module.css', () => ({
  default: {
    session: '', header: '', progress: '', progressBar: '', progressFill: '', nextBtn: '',
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import FlashcardSession from '../FlashcardSession';
import { db } from '../../../services/db';
import type { DBEntry } from '../../../services/db';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_ENTRY: DBEntry = {
  id: 'entry-1',
  userId: 'user-1',
  phrasebookId: 'pb-1',
  sourceText: 'ciao',
  targetText: 'hello',
  tags: [],
  learningScore: 50,
  lastReviewedDate: null,
  decayBaseScore: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_ENTRY_REVIEWED_TODAY: DBEntry = {
  ...MOCK_ENTRY,
  id: 'entry-today',
  lastReviewedDate: new Date().toLocaleDateString('sv'),
};

const onDone = vi.fn();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function renderAndSubmit(answer: string, entry = MOCK_ENTRY) {
  const user = userEvent.setup();
  render(<FlashcardSession entries={[entry]} onDone={onDone} />);
  const input = screen.getByRole('textbox', { name: /your translation/i });
  await user.type(input, answer);
  fireEvent.submit(input.closest('form')!);
  // Allow async state updates
  await act(async () => { await Promise.resolve(); });
}

async function renderAndReveal(entry = MOCK_ENTRY) {
  render(<FlashcardSession entries={[entry]} onDone={onDone} />);
  const revealBtn = screen.getByRole('button', { name: /reveal/i });
  await act(async () => { fireEvent.click(revealBtn); });
  await act(async () => { await Promise.resolve(); });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FlashcardSession — decayBaseScore writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLiveQuery.mockReturnValue([]);
  });

  describe('handleSubmit — correct answer', () => {
    it('writes decayBaseScore equal to newScore in updateEntry', async () => {
      await renderAndSubmit('hello');

      expect(mockUpdateEntry).toHaveBeenCalledOnce();
      const [, changes] = mockUpdateEntry.mock.calls[0] as unknown as [string, Record<string, unknown>];
      expect(changes).toHaveProperty('decayBaseScore');
      expect(changes.decayBaseScore).toBe(changes.learningScore);
    });

    it('writes decayBaseScore equal to newScore in enqueueMutation body', async () => {
      await renderAndSubmit('hello');

      expect(mockEnqueueMutation).toHaveBeenCalledOnce();
      const [, , body] = mockEnqueueMutation.mock.calls[0] as unknown as [string, string, Record<string, unknown>];
      expect(body).toHaveProperty('decayBaseScore');
      expect(body.decayBaseScore).toBe(body.learningScore);
    });

    it('includes learningScore and lastReviewedDate alongside decayBaseScore', async () => {
      await renderAndSubmit('hello');

      const [, changes] = mockUpdateEntry.mock.calls[0] as unknown as [string, Record<string, unknown>];
      expect(changes).toHaveProperty('learningScore');
      expect(changes).toHaveProperty('lastReviewedDate');
      expect(changes).toHaveProperty('decayBaseScore');
    });
  });

  describe('handleSubmit — wrong answer', () => {
    it('does NOT write lastReviewedDate or decayBaseScore on wrong answer', async () => {
      await renderAndSubmit('completely wrong xyz');

      expect(mockUpdateEntry).toHaveBeenCalledOnce();
      const [, changes] = mockUpdateEntry.mock.calls[0] as unknown as [string, Record<string, unknown>];
      expect(changes).toHaveProperty('learningScore');
      expect(changes).not.toHaveProperty('lastReviewedDate');
      expect(changes).not.toHaveProperty('decayBaseScore');
    });

    it('does NOT override decayBaseScore in enqueueMutation body on wrong answer (sends unchanged value)', async () => {
      await renderAndSubmit('completely wrong xyz');

      expect(mockEnqueueMutation).toHaveBeenCalledOnce();
      const [, , body] = mockEnqueueMutation.mock.calls[0] as unknown as [string, string, Record<string, unknown>];
      expect(body).toHaveProperty('learningScore');
      // PUT body is a full entity spread — decayBaseScore is present but unchanged from the original entry
      expect(body.decayBaseScore).toBe(MOCK_ENTRY.decayBaseScore);
    });
  });

  describe('handleSubmit — typo answer', () => {
    // 'helo' is one edit away from 'hello' — triggers typo path
    it('writes lastReviewedDate and decayBaseScore on typo (typos gain points)', async () => {
      await renderAndSubmit('helo');

      expect(mockUpdateEntry).toHaveBeenCalledOnce();
      const [, changes] = mockUpdateEntry.mock.calls[0] as unknown as [string, Record<string, unknown>];
      expect(changes).toHaveProperty('lastReviewedDate');
      expect(changes).toHaveProperty('decayBaseScore');
      expect(changes.decayBaseScore).toBe(changes.learningScore);
    });
  });

  describe('handleReveal', () => {
    it('does NOT write lastReviewedDate or decayBaseScore on reveal (peek)', async () => {
      await renderAndReveal();

      expect(mockUpdateEntry).toHaveBeenCalledOnce();
      const [, changes] = mockUpdateEntry.mock.calls[0] as unknown as [string, Record<string, unknown>];
      expect(changes).toHaveProperty('learningScore');
      expect(changes).not.toHaveProperty('lastReviewedDate');
      expect(changes).not.toHaveProperty('decayBaseScore');
    });

    it('does NOT override decayBaseScore in enqueueMutation body on reveal (sends unchanged value)', async () => {
      await renderAndReveal();

      expect(mockEnqueueMutation).toHaveBeenCalledOnce();
      const [, , body] = mockEnqueueMutation.mock.calls[0] as unknown as [string, string, Record<string, unknown>];
      expect(body).toHaveProperty('learningScore');
      // PUT body is a full entity spread — decayBaseScore is present but unchanged from the original entry
      expect(body.decayBaseScore).toBe(MOCK_ENTRY.decayBaseScore);
    });
  });

  describe('already reviewed today — no writes', () => {
    it('does not call updateEntry when entry was reviewed today', async () => {
      await renderAndSubmit('hello', MOCK_ENTRY_REVIEWED_TODAY);

      expect(mockUpdateEntry).not.toHaveBeenCalled();
      expect(mockEnqueueMutation).not.toHaveBeenCalled();
    });
  });

  describe('live DB guard — reviewed during session', () => {
    it('skips write when live DB shows entry reviewed today (appeared fresh at load)', async () => {
      // Entry was fresh at session load but live DB has today’s date (reviewed on another device)
      vi.mocked(db.entries.get).mockResolvedValueOnce({
        ...MOCK_ENTRY,
        lastReviewedDate: new Date().toLocaleDateString('sv'),
      } as unknown as Awaited<ReturnType<typeof db.entries.get>>);

      await renderAndSubmit('hello');

      expect(mockUpdateEntry).not.toHaveBeenCalled();
      expect(mockEnqueueMutation).not.toHaveBeenCalled();
    });
  });

  describe('score drift — live learningScore differs from session snapshot', () => {
    it('applies delta against live score, not stale snapshot', async () => {
      const driftedScore = 90; // server score drifted up from snapshot value of 50
      vi.mocked(db.entries.get).mockResolvedValueOnce({
        ...MOCK_ENTRY,
        learningScore: driftedScore,
      } as unknown as Awaited<ReturnType<typeof db.entries.get>>);

      await renderAndSubmit('hello'); // correct → +10

      expect(mockUpdateEntry).toHaveBeenCalledOnce();
      const [, changes] = mockUpdateEntry.mock.calls[0] as [string, Record<string, unknown>];
      // applyDelta(90, +10) = 100 (capped at MAX_SCORE)
      expect(changes.learningScore).toBe(100);
    });

    it('mutation body learningScore produces a delta within server bounds', async () => {
      const driftedScore = 90;
      vi.mocked(db.entries.get).mockResolvedValueOnce({
        ...MOCK_ENTRY,
        learningScore: driftedScore,
      } as unknown as Awaited<ReturnType<typeof db.entries.get>>);

      await renderAndSubmit('hello');

      expect(mockEnqueueMutation).toHaveBeenCalledOnce();
      const [, , body] = mockEnqueueMutation.mock.calls[0] as [string, string, Record<string, unknown>];
      // Server computes: delta = body.learningScore − existing.learningScore
      // Using live score as base means this delta is always within [-5, +10]
      const impliedDelta = (body.learningScore as number) - driftedScore;
      expect(impliedDelta).toBeGreaterThanOrEqual(-5);
      expect(impliedDelta).toBeLessThanOrEqual(10);
    });
  });
});
