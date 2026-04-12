import type { LearningState, PartOfSpeech } from '../../types/models';

export interface ActiveFilters {
  phrasebookId: string;
  learningState: LearningState | '';
  partOfSpeech: PartOfSpeech | '';
  tag: string;
}

export const EMPTY_FILTERS: ActiveFilters = {
  phrasebookId: '',
  learningState: '',
  partOfSpeech: '',
  tag: '',
};
