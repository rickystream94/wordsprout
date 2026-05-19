import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockUseLiveQuery, mockGetEntriesForRehearsal, mockGetEntriesForSession } = vi.hoisted(() => ({
  mockUseLiveQuery: vi.fn(),
  mockGetEntriesForRehearsal: vi.fn(),
  mockGetEntriesForSession: vi.fn(),
}));

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: mockUseLiveQuery }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ userId: 'user-1' }),
}));

vi.mock('../../services/db', () => ({
  getEntriesForRehearsal: mockGetEntriesForRehearsal,
  getEntriesForSession: mockGetEntriesForSession,
  getPhrasebooks: vi.fn(async () => []),
}));

vi.mock('../../components/review/SessionSetup', () => ({
  default: ({ onStart }: { onStart: (mode: string, type: string, size: number, pbId: string, posFilter: string[], tagFilter: string[]) => void }) => (
    <div data-testid="session-setup">
      <button
        type="button"
        onClick={() => onStart('competitive', 'random', 10, 'pb-1', [], [])}
        data-testid="start-competitive"
      >
        Start competitive
      </button>
      <button
        type="button"
        onClick={() => onStart('rehearse', 'random', 10, 'pb-1', [], [])}
        data-testid="start-rehearse"
      >
        Start rehearse
      </button>
    </div>
  ),
}));

vi.mock('../../components/review/FlashcardSession', () => ({
  default: ({ onDone }: { onDone: (results: unknown[]) => void }) => (
    <div data-testid="flashcard-session">
      <button type="button" onClick={() => onDone([])}>Done (competitive)</button>
    </div>
  ),
}));

vi.mock('../../components/review/RehearseSession', () => ({
  default: ({ onDone }: { onDone: () => void }) => (
    <div data-testid="rehearse-session">
      <button type="button" onClick={onDone}>Done (rehearse)</button>
    </div>
  ),
}));

vi.mock('../Review.module.css', () => ({ default: {} }));

// ─── Tests ────────────────────────────────────────────────────────────────────

import Review from '../Review';

const PHRASEBOOKS = [
  { id: 'pb-1', userId: 'user-1', name: 'Book 1', targetLanguageName: 'Spanish', sourceLanguageName: 'English', entryCount: 20 },
];
const MOCK_ENTRIES = [{ id: 'e1' }, { id: 'e2' }];

describe('Review page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLiveQuery.mockReturnValue(PHRASEBOOKS);
    mockGetEntriesForSession.mockResolvedValue(MOCK_ENTRIES);
    mockGetEntriesForRehearsal.mockResolvedValue(MOCK_ENTRIES);
  });

  it('renders setup phase by default', () => {
    render(<Review />);
    expect(screen.getByTestId('session-setup')).toBeInTheDocument();
  });

  it('handleStart calls getEntriesForRehearsal when mode is "rehearse"', async () => {
    render(<Review />);
    fireEvent.click(screen.getByTestId('start-rehearse'));
    await waitFor(() => expect(mockGetEntriesForRehearsal).toHaveBeenCalledWith('user-1', 'random', 10, 'pb-1', [], []));
  });

  it('handleStart calls getEntriesForSession when mode is "competitive"', async () => {
    render(<Review />);
    fireEvent.click(screen.getByTestId('start-competitive'));
    await waitFor(() => expect(mockGetEntriesForSession).toHaveBeenCalledWith('user-1', 'random', 10, 'pb-1'));
  });

  it('transitions to RehearseSession when mode is "rehearse"', async () => {
    render(<Review />);
    fireEvent.click(screen.getByTestId('start-rehearse'));
    await waitFor(() => expect(screen.getByTestId('rehearse-session')).toBeInTheDocument());
    expect(screen.queryByTestId('flashcard-session')).not.toBeInTheDocument();
  });

  it('transitions to FlashcardSession when mode is "competitive"', async () => {
    render(<Review />);
    fireEvent.click(screen.getByTestId('start-competitive'));
    await waitFor(() => expect(screen.getByTestId('flashcard-session')).toBeInTheDocument());
    expect(screen.queryByTestId('rehearse-session')).not.toBeInTheDocument();
  });

  it('rehearse onDone returns to setup phase without summary', async () => {
    render(<Review />);
    fireEvent.click(screen.getByTestId('start-rehearse'));
    await waitFor(() => screen.getByTestId('rehearse-session'));
    fireEvent.click(screen.getByText('Done (rehearse)'));
    await waitFor(() => expect(screen.getByTestId('session-setup')).toBeInTheDocument());
    // No summary — goes directly back to setup
    expect(screen.queryByRole('heading', { name: /summary/i })).not.toBeInTheDocument();
  });
});
