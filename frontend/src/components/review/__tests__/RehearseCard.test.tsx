import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RehearseCard from '../RehearseCard';
import type { DBEntry, DBEnrichment } from '../../../services/db';

vi.mock('../RehearseCard.module.css', () => ({
  default: {
    card: '', primary: '', sourceText: '', targetText: '', meta: '', pos: '', tag: '',
    section: '', sectionHeading: '', list: '', nav: '', navBtn: '',
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_ENTRY: DBEntry = {
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

const FULL_ENRICHMENT: DBEnrichment = {
  id: 'en-1',
  userId: 'user-1',
  entryId: 'entry-1',
  exampleSentences: ['Ciao, come stai?', 'Ciao a tutti!'],
  synonyms: ['salve'],
  antonyms: ['addio'],
  collocations: ['ciao ciao'],
  register: 'informal',
  falseFriendWarning: 'Not related to English "chow"',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

// Minimal nav props required by all RehearseCard renders
const NAV = { onPrev: vi.fn(), onNext: vi.fn(), prevDisabled: false, isLast: false };

describe('RehearseCard', () => {
  it('renders sourceText and targetText', () => {
    render(<RehearseCard entry={BASE_ENTRY} enrichment={undefined} {...NAV} />);
    expect(screen.getByText('ciao')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders partOfSpeech badge when present', () => {
    const entry = { ...BASE_ENTRY, partOfSpeech: 'noun' as const };
    render(<RehearseCard entry={entry} enrichment={undefined} {...NAV} />);
    expect(screen.getByText('noun')).toBeInTheDocument();
  });

  it('does not render partOfSpeech badge when absent', () => {
    render(<RehearseCard entry={{ ...BASE_ENTRY, partOfSpeech: undefined }} enrichment={undefined} {...NAV} />);
    expect(screen.queryByText(/noun|verb|adjective/)).not.toBeInTheDocument();
  });

  it('renders tags when non-empty with # prefix', () => {
    const entry = { ...BASE_ENTRY, tags: ['greetings', 'informal'] };
    render(<RehearseCard entry={entry} enrichment={undefined} {...NAV} />);
    expect(screen.getByText('#greetings')).toBeInTheDocument();
    expect(screen.getByText('#informal')).toBeInTheDocument();
  });

  it('does not render tags section when tags is empty', () => {
    render(<RehearseCard entry={{ ...BASE_ENTRY, tags: [] }} enrichment={undefined} {...NAV} />);
    expect(screen.queryByText('greetings')).not.toBeInTheDocument();
  });

  it('renders notes section when present', () => {
    const entry = { ...BASE_ENTRY, notes: 'Common greeting' };
    render(<RehearseCard entry={entry} enrichment={undefined} {...NAV} />);
    expect(screen.getByText('Common greeting')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('does not render notes section when absent', () => {
    render(<RehearseCard entry={{ ...BASE_ENTRY, notes: undefined }} enrichment={undefined} {...NAV} />);
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  it('does not render notes section when notes is empty string', () => {
    render(<RehearseCard entry={{ ...BASE_ENTRY, notes: '' }} enrichment={undefined} {...NAV} />);
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  it('renders no enrichment sections when enrichment is undefined', () => {
    render(<RehearseCard entry={BASE_ENTRY} enrichment={undefined} {...NAV} />);
    expect(screen.queryByText('Example sentences')).not.toBeInTheDocument();
    expect(screen.queryByText('Synonyms')).not.toBeInTheDocument();
    expect(screen.queryByText('Antonyms')).not.toBeInTheDocument();
    expect(screen.queryByText('Collocations')).not.toBeInTheDocument();
    expect(screen.queryByText('Register')).not.toBeInTheDocument();
    expect(screen.queryByText(/False friend/)).not.toBeInTheDocument();
  });

  it('renders all enrichment sections when all fields are populated', () => {
    render(<RehearseCard entry={BASE_ENTRY} enrichment={FULL_ENRICHMENT} {...NAV} />);
    expect(screen.getByText('Example sentences')).toBeInTheDocument();
    expect(screen.getByText('Synonyms')).toBeInTheDocument();
    expect(screen.getByText('Antonyms')).toBeInTheDocument();
    expect(screen.getByText('Collocations')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();
    expect(screen.getByText(/False friend/)).toBeInTheDocument();
    // Spot-check content
    expect(screen.getByText('Ciao, come stai?')).toBeInTheDocument();
    expect(screen.getByText('salve')).toBeInTheDocument();
    expect(screen.getByText('addio')).toBeInTheDocument();
    expect(screen.getByText('informal')).toBeInTheDocument();
    expect(screen.getByText('Not related to English "chow"')).toBeInTheDocument();
  });

  it('does not render empty-array enrichment sections', () => {
    const emptyEnrichment: DBEnrichment = {
      ...FULL_ENRICHMENT,
      exampleSentences: [],
      synonyms: [],
      antonyms: [],
      collocations: [],
      register: undefined,
      falseFriendWarning: undefined,
    };
    render(<RehearseCard entry={BASE_ENTRY} enrichment={emptyEnrichment} {...NAV} />);
    expect(screen.queryByText('Example sentences')).not.toBeInTheDocument();
    expect(screen.queryByText('Synonyms')).not.toBeInTheDocument();
  });

  it('contains no form inputs, submit buttons, or score-related elements', () => {
    render(<RehearseCard entry={BASE_ENTRY} enrichment={FULL_ENRICHMENT} {...NAV} />);
    expect(document.querySelectorAll('input')).toHaveLength(0);
    expect(document.querySelectorAll('button[type="submit"]')).toHaveLength(0);
    expect(screen.queryByText(/learningScore|score delta/i)).not.toBeInTheDocument();
  });
});
