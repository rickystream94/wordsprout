import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockUseLiveQuery } = vi.hoisted(() => ({
  mockUseLiveQuery: vi.fn((fn: () => unknown, _deps: unknown, defaultValue: unknown) => defaultValue),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: mockUseLiveQuery,
}));

vi.mock('../../../services/db', () => ({
  db: {
    entries: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
      })),
    },
  },
}));

vi.mock('../SessionSetup.module.css', () => ({
  default: {
    setup: '', heading: '', field: '', label: '', typeOptions: '', typeOption: '',
    selected: '', hiddenRadio: '', typeDesc: '', sizeOptions: '', sizeBtn: '',
    sizeSelected: '', sizeNote: '', startBtn: '', emptyNote: '', rehearseNotice: '',
    filterSection: '', filterGroup: '', filterCheckboxes: '', filterNote: '',
    filterError: '', filterChip: '',
  },
}));

vi.mock('../../search/SortDropdown', () => ({
  SortDropdown: ({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; label: string }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} data-testid="phrasebook-select">
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import SessionSetup from '../SessionSetup';
import type { DBPhrasebook } from '../../../services/db';
import type { ReviewMode } from '../SessionSetup';
import type { SessionType } from '../SessionSetup';
import type { PartOfSpeech } from '../../../types/models';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePhrasebook(id: string, entryCount = 20): DBPhrasebook {
  return {
    id,
    userId: 'user-1',
    name: `Phrasebook ${id}`,
    sourceLanguageCode: 'en',
    sourceLanguageName: 'English',
    targetLanguageCode: 'it',
    targetLanguageName: 'Italian',
    entryCount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const PHRASEBOOKS = [makePhrasebook('pb-1'), makePhrasebook('pb-2', 30)];

type OnStartArgs = [ReviewMode, SessionType, number, string, PartOfSpeech[], string[]];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SessionSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in competitive mode by default', () => {
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    const competitiveRadio = radios.find((r) => (r as HTMLInputElement).value === 'competitive') as HTMLInputElement;
    expect(competitiveRadio?.checked).toBe(true);
  });

  it('"Competitive" mode does not show rehearse notice', () => {
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    expect(screen.queryByText(/don.*t affect your learning score/i)).not.toBeInTheDocument();
  });

  it('"Rehearse" mode shows "scores not affected" notice', () => {
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    const rehearseRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'rehearse',
    )!;
    fireEvent.click(rehearseRadio);
    expect(screen.getByText(/don.*t affect your learning score/i)).toBeInTheDocument();
  });

  it('sessionType defaults to "random"', () => {
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    const randomRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'random',
    ) as HTMLInputElement;
    expect(randomRadio?.checked).toBe(true);
  });

  it('calls onStart with mode="competitive", empty posFilter and tagFilter on submit in competitive mode', () => {
    const onStart = vi.fn();
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /start session/i }));
    const [mode, , , , posFilter, tagFilter] = onStart.mock.calls[0] as OnStartArgs;
    expect(mode).toBe('competitive');
    expect(posFilter).toEqual([]);
    expect(tagFilter).toEqual([]);
  });

  it('calls onStart with mode="rehearse" and empty filters when no filters selected', () => {
    const onStart = vi.fn();
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={onStart} />);
    const rehearseRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'rehearse',
    )!;
    fireEvent.click(rehearseRadio);
    fireEvent.click(screen.getByRole('button', { name: /start session/i }));
    const [mode, , , , posFilter, tagFilter] = onStart.mock.calls[0] as OnStartArgs;
    expect(mode).toBe('rehearse');
    expect(posFilter).toEqual([]);
    expect(tagFilter).toEqual([]);
  });

  it('shows mode-specific labels in rehearse mode: "Random sample" and "Prioritise low score"', () => {
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    const rehearseRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'rehearse',
    )!;
    fireEvent.click(rehearseRadio);
    expect(screen.getByText('Random sample')).toBeInTheDocument();
    expect(screen.getByText('Prioritise low score')).toBeInTheDocument();
  });

  it('shows default labels "Random" and "Targeted" in competitive mode', () => {
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    expect(screen.getByText('Random')).toBeInTheDocument();
    expect(screen.getByText('Targeted')).toBeInTheDocument();
  });

  it('Start button is disabled when phrasebook has no entries', () => {
    const emptyPb = makePhrasebook('empty', 0);
    render(<SessionSetup phrasebooks={[emptyPb]} onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
  });
});

// ─── T025: Filter interaction tests ───────────────────────────────────────────

describe('SessionSetup filter interactions (rehearse mode)', () => {
  // Helper: set up useLiveQuery to return specific values for each of the 3 hooks
  // Order: (1) availablePoS, (2) availableTags, (3) filteredCount — repeating on re-renders
  function setupLiveQueryMocks(availablePoS: string[], availableTags: string[], filteredCount: number) {
    let callIndex = 0;
    mockUseLiveQuery.mockImplementation(
      (_fn: unknown, _deps: unknown, _default: unknown) => {
        const slot = callIndex++ % 3;
        if (slot === 0) return availablePoS;
        if (slot === 1) return availableTags;
        return filteredCount;
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function switchToRehearseMode() {
    const rehearseRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'rehearse',
    )!;
    fireEvent.click(rehearseRadio);
  }

  it('filter section is not shown in competitive mode', () => {
    setupLiveQueryMocks([], [], 20);
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    expect(screen.queryByRole('group', { name: /part of speech filter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /tag filter/i })).not.toBeInTheDocument();
  });

  it('PoS filter checkboxes appear in rehearse mode when entries have partOfSpeech values', () => {
    setupLiveQueryMocks(['noun', 'verb'], [], 20);
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    switchToRehearseMode();
    expect(screen.getByRole('group', { name: /part of speech filter/i })).toBeInTheDocument();
    // 'noun' should be enabled, others disabled
    const nounCheckbox = screen.getByRole('checkbox', { name: /^noun$/i });
    expect(nounCheckbox).not.toBeDisabled();
  });

  it('tag checkboxes appear in rehearse mode when availableTags is non-empty', () => {
    setupLiveQueryMocks([], ['greetings', 'food'], 20);
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    switchToRehearseMode();
    expect(screen.getByRole('group', { name: /tag filter/i })).toBeInTheDocument();
    expect(screen.getByLabelText('greetings')).toBeInTheDocument();
    expect(screen.getByLabelText('food')).toBeInTheDocument();
  });

  it('tag checkbox toggles are checked/unchecked on click', () => {
    setupLiveQueryMocks([], ['greetings'], 20);
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    switchToRehearseMode();
    const checkbox = screen.getByLabelText('greetings') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect((screen.getByLabelText('greetings') as HTMLInputElement).checked).toBe(true);
  });

  it('PoS checkbox toggles are checked/unchecked on click', () => {
    setupLiveQueryMocks(['noun'], [], 20);
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    switchToRehearseMode();
    const checkbox = screen.getByRole('checkbox', { name: /^noun$/i }) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('filters reset when phrasebook changes', () => {
    setupLiveQueryMocks([], [], 20);
    const onStart = vi.fn();
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={onStart} />);
    switchToRehearseMode();

    // Change phrasebook
    const select = screen.getByTestId('phrasebook-select');
    fireEvent.change(select, { target: { value: 'pb-2' } });

    // Start session — posFilter and tagFilter should be [] after reset
    fireEvent.click(screen.getByRole('button', { name: /start session/i }));
    const [, , , , posFilter, tagFilter] = onStart.mock.calls[0] as OnStartArgs;
    expect(posFilter).toEqual([]);
    expect(tagFilter).toEqual([]);
  });

  it('Start button disabled when filteredCount is 0 and filters are active', () => {
    setupLiveQueryMocks(['noun'], [], 0);
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    switchToRehearseMode();
    // Activate a filter (click noun)
    const checkbox = screen.getByRole('checkbox', { name: /^noun$/i });
    fireEvent.click(checkbox);
    // filteredCount is 0, so "no entries match" message should appear and button disabled
    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
    expect(screen.getByText(/no entries match/i)).toBeInTheDocument();
  });

  it('count notice shown when filteredCount > 0 and < size with active filter', () => {
    setupLiveQueryMocks(['noun'], [], 2);
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    switchToRehearseMode();
    const checkbox = screen.getByRole('checkbox', { name: /^noun$/i });
    fireEvent.click(checkbox);
    expect(screen.getByText(/only 2 matching/i)).toBeInTheDocument();
  });

  it('T028: sessionType defaults to random pre-selected', () => {
    setupLiveQueryMocks([], [], 20);
    render(<SessionSetup phrasebooks={PHRASEBOOKS} onStart={vi.fn()} />);
    const randomRadio = screen.getAllByRole('radio').find(
      (r) => (r as HTMLInputElement).value === 'random',
    ) as HTMLInputElement;
    expect(randomRadio?.checked).toBe(true);
  });
});

