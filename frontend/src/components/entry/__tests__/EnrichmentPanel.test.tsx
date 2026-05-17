import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EnrichmentPanel from '../EnrichmentPanel';
import type { DBEnrichment } from '../../../services/db';

vi.mock('../EnrichmentPanel.module.css', () => ({
  default: {
    fields: '', field: '', warning: '', fieldLabel: '', sentence: '',
    listField: '', listLabel: '', chips: '', chip: '', value: '', meta: '',
  },
}));

vi.mock('../../common/Tooltip', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const BASE_ENRICHMENT: DBEnrichment = {
  id: 'e1',
  userId: 'u1',
  entryId: 'entry-1',
  exampleSentences: ['Example sentence.'],
  synonyms: [],
  antonyms: [],
  collocations: [],
};

describe('EnrichmentPanel', () => {
  it('renders nothing when enrichment is undefined', () => {
    const { container } = render(<EnrichmentPanel enrichment={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when enrichment has no displayable content', () => {
    const empty: DBEnrichment = { ...BASE_ENRICHMENT, exampleSentences: [] };
    const { container } = render(<EnrichmentPanel enrichment={empty} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders enrichment content when present', () => {
    render(<EnrichmentPanel enrichment={BASE_ENRICHMENT} />);
    expect(screen.getByText('Example sentence.')).toBeTruthy();
  });

  it('renders "AI enriched" label when generatedAt is set', () => {
    const enrichment: DBEnrichment = {
      ...BASE_ENRICHMENT,
      generatedAt: '2026-05-17T10:30:00.000Z',
    };
    render(<EnrichmentPanel enrichment={enrichment} />);
    expect(screen.getByText('AI enriched')).toBeTruthy();
  });

  it('does not render "Manually edited" when editedAt is not set', () => {
    const enrichment: DBEnrichment = {
      ...BASE_ENRICHMENT,
      generatedAt: '2026-05-17T10:30:00.000Z',
    };
    render(<EnrichmentPanel enrichment={enrichment} />);
    expect(screen.queryByText('Manually edited')).toBeNull();
  });

  it('renders "Manually edited" label when editedAt is set', () => {
    const enrichment: DBEnrichment = {
      ...BASE_ENRICHMENT,
      generatedAt: '2026-05-17T10:30:00.000Z',
      editedAt: '2026-05-17T11:00:00.000Z',
    };
    render(<EnrichmentPanel enrichment={enrichment} />);
    expect(screen.getByText('Manually edited')).toBeTruthy();
  });

  it('does not render the meta section when generatedAt is not set', () => {
    render(<EnrichmentPanel enrichment={BASE_ENRICHMENT} />);
    expect(screen.queryByText('AI enriched')).toBeNull();
    expect(screen.queryByText('Manually edited')).toBeNull();
  });
});
