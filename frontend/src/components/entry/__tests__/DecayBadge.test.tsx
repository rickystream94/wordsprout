import { vi, describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import DecayBadge from '../DecayBadge';
import type { DBEntry } from '../../../services/db';

// Mock CSS module
vi.mock('../DecayBadge.module.css', () => ({
  default: {
    strip: 'strip',
    stripLabel: 'stripLabel',
    fresh: 'fresh',
    graceWarning: 'graceWarning',
    low: 'low',
    medium: 'medium',
    high: 'high',
  },
}));

const TODAY = '2025-01-21';

function daysAgoFrom(base: string, n: number): string {
  const d = new Date(base);
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
    lastReviewedDate: null,
    decayBaseScore: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── DecayBadge ───────────────────────────────────────────────────────────────

describe('DecayBadge', () => {
  describe('kind: none — renders nothing', () => {
    it('renders null when decayBaseScore is null', () => {
      const { container } = render(
        <DecayBadge entry={makeEntry({ decayBaseScore: null })} today={TODAY} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders null when lastReviewedDate is null', () => {
      const { container } = render(
        <DecayBadge
          entry={makeEntry({ decayBaseScore: 80, lastReviewedDate: null })}
          today={TODAY}
        />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('kind: grace — fresh zone (> 25% of grace remaining)', () => {
    it('renders strip with fresh class', () => {
      // decayBaseScore=80 → grace=21 days; warningThreshold=ceil(21*0.25)=6
      // reviewed 10 days ago → daysLeft=11, 11 > 6 → fresh
      const entry = makeEntry({
        learningScore: 80,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 10),
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      expect(container.querySelector('.strip')).toHaveClass('fresh');
    });

    it('renders stripLabel with fresh class and ✓ safe text', () => {
      const entry = makeEntry({
        learningScore: 80,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 10),
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      const label = container.querySelector('.stripLabel');
      expect(label).toHaveClass('fresh');
      expect(label).toHaveTextContent('✓ safe');
    });

    it('fresh label title mentions days remaining', () => {
      const entry = makeEntry({
        learningScore: 80,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 10), // daysLeft = 11
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      expect(container.querySelector('.stripLabel')).toHaveAttribute('title', expect.stringContaining('11'));
    });
  });

  describe('kind: grace — warning zone (≤ 25% of grace remaining)', () => {
    it('renders strip and label with graceWarning class', () => {
      // daysLeft=5, warningThreshold=6 → 5 <= 6 → graceWarning
      const entry = makeEntry({
        learningScore: 80,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 16), // 21 - 16 = 5 days left
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      expect(container.querySelector('.strip')).toHaveClass('graceWarning');
      expect(container.querySelector('.stripLabel')).toHaveClass('graceWarning');
    });

    it('label shows countdown text', () => {
      const entry = makeEntry({
        learningScore: 80,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 16), // 5 days left
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      expect(container.querySelector('.stripLabel')).toHaveTextContent('⏳ 5d');
    });

    it('label shows "today" when daysLeft is 0', () => {
      const entry = makeEntry({
        learningScore: 80,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 21),
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      expect(container.querySelector('.stripLabel')).toHaveTextContent('⏳ today');
    });
  });

  describe('kind: decaying — urgency coloured strip + label', () => {
    it('renders strip and label with low urgency class', () => {
      // base=80, current=77 → pointsLost=3, 3/80≈3.75% → low
      const entry = makeEntry({
        learningScore: 77,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 30),
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      expect(container.querySelector('.strip')).toHaveClass('low');
      expect(container.querySelector('.stripLabel')).toHaveClass('low');
    });

    it('low urgency label shows points lost', () => {
      const entry = makeEntry({
        learningScore: 77,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 30),
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      expect(container.querySelector('.stripLabel')).toHaveTextContent('↓ 3pts');
    });

    it('renders strip and label with medium urgency class', () => {
      const entry = makeEntry({
        learningScore: 67,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 60),
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      expect(container.querySelector('.strip')).toHaveClass('medium');
      expect(container.querySelector('.stripLabel')).toHaveTextContent('↓ 13pts');
    });

    it('renders strip and label with high urgency class', () => {
      const entry = makeEntry({
        learningScore: 50,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 120),
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      expect(container.querySelector('.strip')).toHaveClass('high');
      expect(container.querySelector('.stripLabel')).toHaveTextContent('↓ 30pts');
    });

    it('high urgency label title mentions urgency', () => {
      const entry = makeEntry({
        learningScore: 50,
        decayBaseScore: 80,
        lastReviewedDate: daysAgoFrom(TODAY, 120),
      });
      const { container } = render(<DecayBadge entry={entry} today={TODAY} />);
      expect(container.querySelector('.stripLabel')).toHaveAttribute('title', expect.stringContaining('urgently'));
    });
  });
});

