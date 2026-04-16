import { useEffect, useRef, useState } from 'react';
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

// ── Custom multi-select dropdown ──────────────────────────────────────────────

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function MultiSelectDropdown({ placeholder, options, selected, onChange }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? placeholder
        : `${selected.length} selected`;

  return (
    <div className={styles.dropdown} ref={ref}>
      <button
        type="button"
        className={`${styles.dropdownTrigger} ${selected.length > 0 ? styles.dropdownActive : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.dropdownLabel}>{label}</span>
        {selected.length > 0 && (
          <span className={styles.dropdownCount}>{selected.length}</span>
        )}
        <svg className={`${styles.dropdownChevron} ${open ? styles.dropdownChevronOpen : ''}`}
          width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className={styles.dropdownMenu} role="listbox" aria-multiselectable="true">
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label key={opt.value} className={`${styles.dropdownItem} ${checked ? styles.dropdownItemChecked : ''}`}>
                <input
                  type="checkbox"
                  className={styles.dropdownCheckbox}
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── FilterPanel ───────────────────────────────────────────────────────────────

const LEARNING_STATE_OPTIONS: MultiSelectOption[] = [
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'mastered', label: 'Mastered' },
];

const PART_OF_SPEECH_OPTIONS: MultiSelectOption[] = [
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

  const phrasebookOptions: MultiSelectOption[] = (phrasebooks ?? []).map((pb) => ({
    value: pb.id,
    label: pb.name,
  }));

  const tagOptions: MultiSelectOption[] = (allTags ?? []).map((tag) => ({
    value: tag,
    label: `#${tag}`,
  }));

  const activeCount =
    filters.phrasebookIds.length +
    filters.learningStates.length +
    filters.partsOfSpeech.length +
    filters.tags.length;

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <MultiSelectDropdown
          placeholder="All phrasebooks"
          options={phrasebookOptions}
          selected={filters.phrasebookIds}
          onChange={(v) => onChange({ ...filters, phrasebookIds: v })}
        />
        <MultiSelectDropdown
          placeholder="All states"
          options={LEARNING_STATE_OPTIONS}
          selected={filters.learningStates as string[]}
          onChange={(v) => onChange({ ...filters, learningStates: v as LearningState[] })}
        />
        <MultiSelectDropdown
          placeholder="All parts of speech"
          options={PART_OF_SPEECH_OPTIONS}
          selected={filters.partsOfSpeech as string[]}
          onChange={(v) => onChange({ ...filters, partsOfSpeech: v as PartOfSpeech[] })}
        />
        {tagOptions.length > 0 && (
          <MultiSelectDropdown
            placeholder="All tags"
            options={tagOptions}
            selected={filters.tags}
            onChange={(v) => onChange({ ...filters, tags: v })}
          />
        )}
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
