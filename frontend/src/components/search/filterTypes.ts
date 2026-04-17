import type { ScoreRange } from '../../services/scoring';
import type { PartOfSpeech } from '../../types/models';

export interface ActiveFilters {
  phrasebookIds: string[];
  scoreRanges: ScoreRange[];
  partsOfSpeech: PartOfSpeech[];
  tags: string[];
}

export const EMPTY_FILTERS: ActiveFilters = {
  phrasebookIds: [],
  scoreRanges: [],
  partsOfSpeech: [],
  tags: [],
};
