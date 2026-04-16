import type { LearningState, PartOfSpeech } from '../../types/models';

export interface ActiveFilters {
  phrasebookIds: string[];
  learningStates: LearningState[];
  partsOfSpeech: PartOfSpeech[];
  tags: string[];
}

export const EMPTY_FILTERS: ActiveFilters = {
  phrasebookIds: [],
  learningStates: [],
  partsOfSpeech: [],
  tags: [],
};
