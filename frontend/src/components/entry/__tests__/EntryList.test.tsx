import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EntryList from '../EntryList';
import type { DBEntry } from '../../../services/db';

// ─── CSS module mocks ────────────────────────────────────────────────────────

vi.mock('../EntryList.module.css', () => ({ default: {} }));

// ─── Child component mocks ───────────────────────────────────────────────────

vi.mock('../DecayBadge', () => ({ default: () => null }));
vi.mock('../EnrichmentPanel', () => ({ default: () => null }));
vi.mock('../LearningScoreBar', () => ({ default: () => null }));
vi.mock('../../common/ConfirmDialog', () => ({ default: () => null }));

// ─── Service / hook mocks ────────────────────────────────────────────────────

vi.mock('../../../services/db', () => ({
  getEnrichment: vi.fn().mockResolvedValue(undefined),
  upsertEnrichment: vi.fn(),
  updateEntry: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  enrichApi: { enrich: vi.fn() },
}));

vi.mock('../../../services/sync', () => ({
  usePendingIds: () => new Set<string>(),
}));

vi.mock('../../../services/scoring', () => ({
  scoreToRange: () => 'dormant',
  todayKey: () => '2026-05-17',
}));

vi.mock('../../../hooks/useQuota', () => ({
  useQuota: () => ({
    quota: null,
    remaining: 0,
    isLow: false,
    isExhausted: false,
    refreshQuota: vi.fn(),
  }),
}));

vi.mock('../../../config/env', () => ({
  FEATURES_AI_ENABLED: false,
}));

// ─── Virtualizer mock ────────────────────────────────────────────────────────
// Render all items synchronously without any scroll-based virtualisation.

vi.mock('@tanstack/react-virtual', () => ({
  useWindowVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 88,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 88 })),
    measureElement: () => {},
    options: { scrollMargin: 0 },
  }),
}));

// ─── Browser API stubs ───────────────────────────────────────────────────────

beforeEach(() => {
  globalThis.ResizeObserver = vi.fn().mockImplementation(function (this: ResizeObserver) {
    (this as unknown as Record<string, unknown>).observe = vi.fn();
    (this as unknown as Record<string, unknown>).unobserve = vi.fn();
    (this as unknown as Record<string, unknown>).disconnect = vi.fn();
  }) as unknown as typeof ResizeObserver;
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CREATED_AT = '2026-05-01T09:00:00.000Z';

function makeEntry(overrides: Partial<DBEntry> = {}): DBEntry {
  return {
    id: 'entry-1',
    userId: 'user-1',
    phrasebookId: 'pb-1',
    sourceText: 'ciao',
    targetText: 'hello',
    notes: '',
    tags: [],
    learningScore: 50,
    lastReviewedDate: null,
    decayBaseScore: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function expandCard() {
  const button = screen.getByRole('button', { name: /ciao/i });
  fireEvent.click(button);
  // Wait for async enrichment fetch to complete
  await waitFor(() => expect(screen.getByText('Created on')).toBeTruthy());
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EntryCard date display', () => {
  it('shows no date labels on the collapsed card', () => {
    render(<EntryList entries={[makeEntry()]} />);
    expect(screen.queryByText('Created on')).toBeNull();
    expect(screen.queryByText('Last reviewed')).toBeNull();
    expect(screen.queryByText('Entry edited')).toBeNull();
  });

  it('shows "Created on" in expanded view', async () => {
    render(<EntryList entries={[makeEntry()]} />);
    await expandCard();
    expect(screen.getByText('Created on')).toBeTruthy();
  });

  it('shows "Last reviewed: Never" when lastReviewedDate is null', async () => {
    render(<EntryList entries={[makeEntry({ lastReviewedDate: null })]} />);
    await expandCard();
    expect(screen.getByText('Last reviewed')).toBeTruthy();
    expect(screen.getByText('Never')).toBeTruthy();
  });

  it('shows a formatted datetime for lastReviewedDate when set', async () => {
    render(
      <EntryList entries={[makeEntry({ lastReviewedDate: '2026-05-10T14:00:00.000Z' })]} />
    );
    await expandCard();
    expect(screen.getByText('Last reviewed')).toBeTruthy();
    expect(screen.queryByText('Never')).toBeNull();
  });

  it('does not show "Entry edited" when updatedAt equals createdAt', async () => {
    render(<EntryList entries={[makeEntry({ updatedAt: CREATED_AT })]} />);
    await expandCard();
    expect(screen.queryByText('Entry edited')).toBeNull();
  });

  it('shows "Entry edited" when updatedAt differs from createdAt', async () => {
    render(
      <EntryList
        entries={[makeEntry({ updatedAt: '2026-05-15T16:00:00.000Z' })]}
      />
    );
    await expandCard();
    expect(screen.getByText('Entry edited')).toBeTruthy();
  });
});
