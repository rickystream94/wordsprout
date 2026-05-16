import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import ReviewCard, { type ReviewCardProps } from '../ReviewCard';
import type { DBEntry } from '../../../services/db';

// Mock CSS modules
vi.mock('../ReviewCard.module.css', () => ({
  default: {
    card: '', reviewedBanner: '', prompt: '', promptLabel: '', sourceText: '',
    meta: '', posBadge: '', tagBadge: '', hintReveal: '', inputRow: '', answerInput: '',
    btnRow: '', submitBtn: '', revealBtn: '', hintBtn: '', resultRow: '', correctBadge: '',
    typoBadge: '', wrongBadge: '', synonymHint: '', submittedText: '', correctAnswer: '',
    allAnswers: '', scoreBar: '', scoreBarFill: '', scoreDelta: '',
  },
}));

const MOCK_ENTRY: DBEntry = {
  id: 'entry-1',
  userId: 'user-1',
  phrasebookId: 'pb-1',
  sourceText: 'ciao',
  targetText: 'hello',
  tags: [],
  learningScore: 50,
  lastReviewedDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const DEFAULT_PROPS: ReviewCardProps = {
  entry: MOCK_ENTRY,
  reviewedToday: false,
  hintsUsed: 0,
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
  onHint: vi.fn(),
};

describe('ReviewCard', () => {
  it('renders the sourceText of the entry', () => {
    render(<ReviewCard {...DEFAULT_PROPS} />);
    expect(screen.getByText('ciao')).toBeTruthy();
  });

  it('renders the translate prompt', () => {
    render(<ReviewCard {...DEFAULT_PROPS} targetLanguageName="English" />);
    expect(screen.getByText(/Translate to English:/i)).toBeTruthy();
  });

  it('renders a generic translate prompt when no targetLanguageName', () => {
    render(<ReviewCard {...DEFAULT_PROPS} />);
    expect(screen.getByText(/Translate:/i)).toBeTruthy();
  });

  it('renders the answer input when not yet answered', () => {
    render(<ReviewCard {...DEFAULT_PROPS} />);
    expect(screen.getByRole('textbox', { name: /your translation/i })).toBeTruthy();
  });

  it('disables the submit button when input is empty', () => {
    render(<ReviewCard {...DEFAULT_PROPS} />);
    expect((screen.getByRole('button', { name: /submit/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables submit button when input is not empty', async () => {
    const user = userEvent.setup();
    render(<ReviewCard {...DEFAULT_PROPS} />);
    await user.type(screen.getByRole('textbox'), 'hello');
    expect((screen.getByRole('button', { name: /submit/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onSubmit when form is submitted', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ReviewCard {...DEFAULT_PROPS} onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox');
    await user.type(input, 'hello');
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('calls onHint when hint button is clicked', async () => {
    const onHint = vi.fn();
    const user = userEvent.setup();
    render(<ReviewCard {...DEFAULT_PROPS} onHint={onHint} />);
    const hintBtn = screen.getByRole('button', { name: /hint/i });
    await user.click(hintBtn);
    expect(onHint).toHaveBeenCalled();
  });

  it('calls onReveal when reveal button is clicked', async () => {
    const onReveal = vi.fn();
    const user = userEvent.setup();
    render(<ReviewCard {...DEFAULT_PROPS} onReveal={onReveal} />);
    const revealBtn = screen.getByRole('button', { name: /reveal/i });
    await user.click(revealBtn);
    expect(onReveal).toHaveBeenCalled();
  });

  it('shows "already reviewed today" banner when reviewedToday is true', () => {
    render(<ReviewCard {...DEFAULT_PROPS} reviewedToday />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/already reviewed today/i)).toBeTruthy();
  });

  it('shows hint string when hintsUsed > 0 and not yet answered', () => {
    render(<ReviewCard {...DEFAULT_PROPS} hintsUsed={1} />);
    expect(screen.getByLabelText(/hint/i)).toBeTruthy();
  });

  it('renders tags when entry has them', () => {
    const entryWithTags: DBEntry = { ...MOCK_ENTRY, tags: ['greetings', 'basic'] };
    render(<ReviewCard {...DEFAULT_PROPS} entry={entryWithTags} />);
    expect(screen.getByText('#greetings')).toBeTruthy();
    expect(screen.getByText('#basic')).toBeTruthy();
  });

  it('renders part of speech badge when entry has partOfSpeech', () => {
    const entryWithPos: DBEntry = { ...MOCK_ENTRY, partOfSpeech: 'noun' };
    render(<ReviewCard {...DEFAULT_PROPS} entry={entryWithPos} />);
    expect(screen.getByText('noun')).toBeTruthy();
  });
});
