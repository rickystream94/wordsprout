import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../auth/AuthProvider';
import type { DBPhrasebook } from '../../services/db';
import { db } from '../../services/db';
import type { LearningState, PartOfSpeech } from '../../types/models';
import type { ActiveFilters } from './filterTypes';
import { EMPTY_FILTERS } from './filterTypes';
import styles from './FilterPanel.module.css';

interface FilterPanelProps {
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
}

const LEARNING_STATE_OPTIONS: { value: LearningState | ''; label: string }[] = [
  { value: '', label: 'All states' },
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'mastered', label: 'Mastered' },
];

const PART_OF_SPEECH_OPTIONS: { value: PartOfSpeech | ''; label: string }[] = [
  { value: '', label: 'All parts of speech' },
  { value: 'noun', label: 'Noun' },
  { value: 'verb', label: 'Verb' },
  { value: 'adjective', label: 'Adjective' },
  { value: 'adverb', label: 'Adverb' },
  { value: 'idiom', label: 'Idiom' },
  { value: 'phrasal_verb', label: 'Phrasal Verb' },
  { value: 'other', label: 'Other' },
];

export default function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const { userId } = useAuth();

  const phrasebooks = useLiveQuery<DBPhrasebook[]>(
    () => (userId ? db.phrasebooks.where('userId').equals(userId).toArray() : Promise.resolve([])),
    [userId],
  );

  const allTags = useLiveQuery<string[]>(
    () =>
      userId
        ? db.entries
            .where('userId')
            .equals(userId)
            .toArray()
            .then((entries) => {
              const set = new Set<string>();
              for (const e of entries) for (const t of e.tags) set.add(t);
              return [...set].sort();
            })
        : Promise.resolve([]),
    [userId],
  );

  const activeCount = Object.values(filters).filter(Boolean).length;

  function update(key: keyof ActiveFilters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        {/* Phrasebook filter */}
        <select
          className={styles.select}
          value={filters.phrasebookId}
          onChange={(e) => update('phrasebookId', e.target.value)}
          aria-label="Filter by phrasebook"
        >
          <option value="">All phrasebooks</option>
          {(phrasebooks ?? []).map((pb: DBPhrasebook) => (
            <option key={pb.id} value={pb.id}>{pb.name}</option>
          ))}
        </select>

        {/* Learning state filter */}
        <select
          className={styles.select}
          value={filters.learningState}
          onChange={(e) => update('learningState', e.target.value)}
          aria-label="Filter by learning state"
        >
          {LEARNING_STATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Part of speech filter */}
        <select
          className={styles.select}
          value={filters.partOfSpeech}
          onChange={(e) => update('partOfSpeech', e.target.value)}
          aria-label="Filter by part of speech"
        >
          {PART_OF_SPEECH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Tag filter */}
        <select
          className={styles.select}
          value={filters.tag}
          onChange={(e) => update('tag', e.target.value)}
          aria-label="Filter by tag"
        >
          <option value="">All tags</option>
          {(allTags ?? []).map((tag: string) => (
            <option key={tag} value={tag}>#{tag}</option>
          ))}
        </select>
      </div>

      {activeCount > 0 && (
        <div className={styles.clearRow}>
          <span className={styles.badge}>{activeCount} filter{activeCount > 1 ? 's' : ''} active</span>
          <button
            className={styles.clearAll}
            onClick={() => onChange(EMPTY_FILTERS)}
            type="button"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
