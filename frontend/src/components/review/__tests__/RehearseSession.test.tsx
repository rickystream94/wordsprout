import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockUseLiveQuery, mockUseSwipe } = vi.hoisted(() => ({
  mockUseLiveQuery: vi.fn(() => []),
  mockUseSwipe: vi.fn(() => ({ current: null })),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: mockUseLiveQuery,
}));

vi.mock('../../../hooks/useSwipe', () => ({
  useSwipe: mockUseSwipe,
}));

vi.mock('../../../services/db', () => ({
  db: {
    enrichments: {
      where: vi.fn(() => ({ anyOf: vi.fn(() => ({ toArray: vi.fn(async () => []) })) })),
    },
  },
}));

vi.mock('../RehearseSession.module.css', () => ({
  default: {
    session: '', header: '', exitBtn: '', progress: '', rehearseBadge: '',
    swipeHintLeft: '', swipeHintRight: '',
  },
}));

vi.mock('../RehearseCard.module.css', () => ({
  default: {
    card: '', primary: '', sourceText: '', targetText: '', meta: '', pos: '', tag: '',
    section: '', sectionHeading: '', list: '', nav: '', navBtn: '',
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import RehearseSession from '../RehearseSession';
import type { DBEntry } from '../../../services/db';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(id: string, sourceText: string): DBEntry {
  return {
    id,
    userId: 'user-1',
    phrasebookId: 'pb-1',
    sourceText,
    tags: [],
    learningScore: 50,
    lastReviewedDate: null,
    decayBaseScore: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const THREE_ENTRIES = [
  makeEntry('e1', 'uno'),
  makeEntry('e2', 'due'),
  makeEntry('e3', 'tre'),
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RehearseSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLiveQuery.mockReturnValue([]);
    mockUseSwipe.mockReturnValue({ current: null });
  });

  it('shows progress "1 / N" on first render', () => {
    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('"Next →" button advances to next card and updates progress', () => {
    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    expect(screen.getByText('uno')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go to next card/i }));
    expect(screen.getByText('due')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('"Finish" button on last card calls onDone', () => {
    const onDone = vi.fn();
    render(<RehearseSession entries={THREE_ENTRIES} onDone={onDone} />);
    // Navigate to last card
    fireEvent.click(screen.getByRole('button', { name: /go to next card/i }));
    fireEvent.click(screen.getByRole('button', { name: /go to next card/i }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('"← Exit" button calls onDone', () => {
    const onDone = vi.fn();
    render(<RehearseSession entries={THREE_ENTRIES} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /exit rehearse session/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('"← Prev" button is disabled on first card', () => {
    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    expect(screen.getByRole('button', { name: /go to previous card/i })).toBeDisabled();
  });

  it('"← Prev" button retreats to previous card', () => {
    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /go to next card/i }));
    expect(screen.getByText('due')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go to previous card/i }));
    expect(screen.getByText('uno')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('"scores not affected" badge always visible', () => {
    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    expect(screen.getByText(/scores not affected/i)).toBeInTheDocument();
  });

  it('does not import updateEntry, enqueueMutation, or scoring utilities', async () => {
    // Static import guard: verify the module does not reference scoring
    const mod = await import('../RehearseSession');
    const modText = mod.default.toString();
    expect(modText).not.toContain('updateEntry');
    expect(modText).not.toContain('enqueueMutation');
  });

  // ─── T017: Swipe end-to-end behaviour ───────────────────────────────────────

  it('useSwipe onSwipeLeft callback advances to next card', () => {
    let capturedOnSwipeLeft: (() => void) | undefined;
    mockUseSwipe.mockImplementation(({ onSwipeLeft }: { onSwipeLeft?: () => void }) => {
      capturedOnSwipeLeft = onSwipeLeft;
      return { current: null };
    });

    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    expect(screen.getByText('uno')).toBeInTheDocument();
    act(() => { capturedOnSwipeLeft?.(); });
    expect(screen.getByText('due')).toBeInTheDocument();
  });

  it('useSwipe onSwipeLeft on last card calls onDone', () => {
    const onDone = vi.fn();
    let capturedOnSwipeLeft: (() => void) | undefined;
    mockUseSwipe.mockImplementation(({ onSwipeLeft }: { onSwipeLeft?: () => void }) => {
      capturedOnSwipeLeft = onSwipeLeft;
      return { current: null };
    });

    render(<RehearseSession entries={THREE_ENTRIES} onDone={onDone} />);
    // Navigate to last card manually
    fireEvent.click(screen.getByRole('button', { name: /go to next card/i }));
    fireEvent.click(screen.getByRole('button', { name: /go to next card/i }));
    capturedOnSwipeLeft?.();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('useSwipe onSwipeRight on first card is a no-op (index stays 0)', () => {
    let capturedOnSwipeRight: (() => void) | undefined;
    mockUseSwipe.mockImplementation(({ onSwipeRight }: { onSwipeRight?: () => void }) => {
      capturedOnSwipeRight = onSwipeRight;
      return { current: null };
    });

    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    capturedOnSwipeRight?.();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('uno')).toBeInTheDocument();
  });

  it('useSwipe onSwipeRight retreats index from a non-zero position', () => {
    let capturedOnSwipeRight: (() => void) | undefined;
    mockUseSwipe.mockImplementation(({ onSwipeRight }: { onSwipeRight?: () => void }) => {
      capturedOnSwipeRight = onSwipeRight;
      return { current: null };
    });

    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /go to next card/i }));
    expect(screen.getByText('due')).toBeInTheDocument();
    act(() => { capturedOnSwipeRight?.(); });
    expect(screen.getByText('uno')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  // ─── T019: Keyboard navigation ───────────────────────────────────────────────

  it('ArrowRight advances to next card', () => {
    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    const session = screen.getByRole('region', { name: /rehearse session/i });
    fireEvent.keyDown(session, { key: 'ArrowRight' });
    expect(screen.getByText('due')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('ArrowLeft retreats to previous card', () => {
    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    const session = screen.getByRole('region', { name: /rehearse session/i });
    fireEvent.keyDown(session, { key: 'ArrowRight' });
    fireEvent.keyDown(session, { key: 'ArrowLeft' });
    expect(screen.getByText('uno')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('ArrowLeft no-ops on first card', () => {
    render(<RehearseSession entries={THREE_ENTRIES} onDone={vi.fn()} />);
    const session = screen.getByRole('region', { name: /rehearse session/i });
    fireEvent.keyDown(session, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('uno')).toBeInTheDocument();
  });

  it('ArrowRight on last card calls onDone', () => {
    const onDone = vi.fn();
    render(<RehearseSession entries={THREE_ENTRIES} onDone={onDone} />);
    const session = screen.getByRole('region', { name: /rehearse session/i });
    fireEvent.keyDown(session, { key: 'ArrowRight' });
    fireEvent.keyDown(session, { key: 'ArrowRight' });
    fireEvent.keyDown(session, { key: 'ArrowRight' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
