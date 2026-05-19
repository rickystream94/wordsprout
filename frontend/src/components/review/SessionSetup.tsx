import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DBPhrasebook } from '../../services/db';
import type { PartOfSpeech } from '../../types/models';
import { SortDropdown } from '../search/SortDropdown';
import styles from './SessionSetup.module.css';

export type SessionType = 'random' | 'targeted';
export type ReviewMode = 'competitive' | 'rehearse';

// ── Shared multi-select dropdown (mirrors FilterPanel pattern) ────────────────

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

  const triggerLabel =
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
        <span className={styles.dropdownLabel}>{triggerLabel}</span>
        {selected.length > 0 && (
          <span className={styles.dropdownCount}>{selected.length}</span>
        )}
        <svg
          className={`${styles.dropdownChevron} ${open ? styles.dropdownChevronOpen : ''}`}
          width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
        >
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className={styles.dropdownMenu} role="listbox" aria-multiselectable="true">
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`${styles.dropdownItem} ${checked ? styles.dropdownItemChecked : ''}`}
              >
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

interface SessionSetupProps {
  phrasebooks: DBPhrasebook[];
  onStart: (
    mode: ReviewMode,
    type: SessionType,
    size: number,
    phrasebookId: string,
    posFilter: PartOfSpeech[],
    tagFilter: string[],
  ) => void;
}

const SIZE_OPTIONS = [5, 10, 20, 50];

export default function SessionSetup({ phrasebooks, onStart }: SessionSetupProps) {
  const [reviewMode, setReviewMode] = useState<ReviewMode>('competitive');
  const [sessionType, setSessionType] = useState<SessionType>('random');
  const [selectedPhrasebookId, setSelectedPhrasebookId] = useState<string>(
    phrasebooks[0]?.id ?? '',
  );
  const [posFilter, setPosFilter] = useState<PartOfSpeech[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  // If phrasebooks loaded asynchronously and nothing is selected yet, fall back to the first
  const effectivePhrasebookId = selectedPhrasebookId || phrasebooks[0]?.id || '';
  const [size, setSize] = useState(10);

  const selectedPhrasebook = phrasebooks.find((p) => p.id === effectivePhrasebookId);
  const totalEntries = selectedPhrasebook?.entryCount ?? 0;
  const actualSize = Math.min(size, totalEntries);

  // Derive available PoS values from current phrasebook entries (rehearse mode only)
  const availablePoS = useLiveQuery<PartOfSpeech[]>(
    () => effectivePhrasebookId && reviewMode === 'rehearse'
      ? db.entries.where('phrasebookId').equals(effectivePhrasebookId).toArray().then((entries) => {
          const posSet = new Set<PartOfSpeech>();
          for (const e of entries) {
            if (e.partOfSpeech) posSet.add(e.partOfSpeech);
          }
          return Array.from(posSet);
        })
      : Promise.resolve([]),
    [effectivePhrasebookId, reviewMode],
  ) ?? [];

  // Available tags for the current phrasebook (rehearse mode only)
  const availableTags = useLiveQuery<string[]>(
    () => effectivePhrasebookId && reviewMode === 'rehearse'
      ? db.entries.where('phrasebookId').equals(effectivePhrasebookId).toArray().then((entries) => {
          const tagSet = new Set<string>();
          for (const e of entries) {
            for (const t of e.tags) tagSet.add(t);
          }
          return Array.from(tagSet).sort();
        })
      : Promise.resolve([]),
    [effectivePhrasebookId, reviewMode],
  ) ?? [];

  // Filtered count estimate (for feedback when filters are active in rehearse mode)
  const filteredCount = useLiveQuery<number>(
    () => {
      if (reviewMode !== 'rehearse' || !effectivePhrasebookId) return Promise.resolve(totalEntries);
      if (posFilter.length === 0 && tagFilter.length === 0) return Promise.resolve(totalEntries);
      return db.entries.where('phrasebookId').equals(effectivePhrasebookId).toArray().then((entries) => {
        let pool = entries;
        if (posFilter.length > 0) {
          pool = pool.filter((e) => e.partOfSpeech !== undefined && posFilter.includes(e.partOfSpeech));
        }
        if (tagFilter.length > 0) {
          pool = pool.filter((e) => e.tags.some((t) => tagFilter.includes(t)));
        }
        return pool.length;
      });
    },
    [effectivePhrasebookId, reviewMode, posFilter.join(','), tagFilter.join(','), totalEntries],
  ) ?? totalEntries;

  const filtersActive = posFilter.length > 0 || tagFilter.length > 0;
  const effectiveSize = filtersActive ? Math.min(size, filteredCount) : actualSize;

  function handlePhrasebookChange(id: string) {
    setSelectedPhrasebookId(id);
    setPosFilter([]);
    setTagFilter([]);
  }

  const startDisabled = totalEntries === 0 || !effectivePhrasebookId || (filtersActive && filteredCount === 0);

  return (
    <div className={styles.setup}>
      <h2 className={styles.heading}>Start a review session</h2>

      <div className={styles.field}>
        <span className={styles.label}>Review mode</span>
        <div className={styles.typeOptions}>
          <label className={`${styles.typeOption} ${reviewMode === 'competitive' ? styles.selected : ''}`}>
            <input
              type="radio"
              name="reviewMode"
              value="competitive"
              checked={reviewMode === 'competitive'}
              onChange={() => setReviewMode('competitive')}
              className={styles.hiddenRadio}
            />
            <strong>Competitive</strong>
            <span className={styles.typeDesc}>Submit translations and track your score</span>
          </label>
          <label className={`${styles.typeOption} ${reviewMode === 'rehearse' ? styles.selected : ''}`}>
            <input
              type="radio"
              name="reviewMode"
              value="rehearse"
              checked={reviewMode === 'rehearse'}
              onChange={() => setReviewMode('rehearse')}
              className={styles.hiddenRadio}
            />
            <strong>Rehearse</strong>
            <span className={styles.typeDesc}>Browse cards and all their details — no score impact</span>
          </label>
        </div>
        {reviewMode === 'rehearse' && (
          <p className={styles.rehearseNotice}>Rehearse sessions don&apos;t affect your learning score.</p>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Phrasebook</label>
        <SortDropdown
          value={effectivePhrasebookId}
          options={phrasebooks.map((pb) => ({
            value: pb.id,
            label: `${pb.name} (${pb.entryCount} ${pb.entryCount === 1 ? 'entry' : 'entries'})`,
          }))}
          onChange={handlePhrasebookChange}
          label=""
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Session type</span>
        <div className={styles.typeOptions}>
          <label className={`${styles.typeOption} ${sessionType === 'random' ? styles.selected : ''}`}>
            <input
              type="radio"
              name="sessionType"
              value="random"
              checked={sessionType === 'random'}
              onChange={() => setSessionType('random')}
              className={styles.hiddenRadio}
            />
            <strong>Random</strong>
            <span className={styles.typeDesc}>Sample evenly from all entries</span>
          </label>
          <label className={`${styles.typeOption} ${sessionType === 'targeted' ? styles.selected : ''}`}>
            <input
              type="radio"
              name="sessionType"
              value="targeted"
              checked={sessionType === 'targeted'}
              onChange={() => setSessionType('targeted')}
              className={styles.hiddenRadio}
            />
            <strong>Targeted</strong>
            <span className={styles.typeDesc}>Focus on entries with the lowest learning score</span>
          </label>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Cards per session</span>
        <div className={styles.sizeOptions} role="group" aria-label="Select session size">
          {SIZE_OPTIONS.filter((s) => s <= totalEntries || s === SIZE_OPTIONS[0]).map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.sizeBtn} ${size === s ? styles.sizeSelected : ''}`}
              onClick={() => setSize(s)}
              disabled={s > totalEntries}
            >
              {s}
            </button>
          ))}
        </div>
        {actualSize < size && !filtersActive && (
          <p className={styles.sizeNote}>Only {totalEntries} entries available — using {actualSize}</p>
        )}
      </div>

      {reviewMode === 'rehearse' && (availablePoS.length > 0 || availableTags.length > 0) && (
        <div className={styles.filterSection}>
          <span className={styles.label}>
            Filters <span className={styles.optionalHint}>(optional)</span>
          </span>
          <div className={styles.filterRow}>
            {availablePoS.length > 0 && (
              <MultiSelectDropdown
                placeholder="Part of speech"
                options={availablePoS.map((pos) => ({
                  value: pos,
                  label: pos.replace('_', ' '),
                }))}
                selected={posFilter}
                onChange={(values) => setPosFilter(values as PartOfSpeech[])}
              />
            )}
            {availableTags.length > 0 && (
              <MultiSelectDropdown
                placeholder="Tags"
                options={availableTags.map((tag) => ({ value: tag, label: `#${tag}` }))}
                selected={tagFilter}
                onChange={setTagFilter}
              />
            )}
          </div>
          {filtersActive && filteredCount === 0 && (
            <p className={styles.filterError}>No entries match these filters — adjust filters to continue.</p>
          )}
          {filtersActive && filteredCount > 0 && filteredCount < size && (
            <p className={styles.filterNote}>Only {filteredCount} matching {filteredCount === 1 ? 'entry' : 'entries'} — session will use all of them.</p>
          )}
        </div>
      )}

      <button
        type="button"
        className={styles.startBtn}
        onClick={() => onStart(reviewMode, sessionType, effectiveSize, effectivePhrasebookId, posFilter, tagFilter)}
        disabled={startDisabled}
      >
        Start session
      </button>

      {phrasebooks.length === 0 && (
        <p className={styles.emptyNote}>Create a phrasebook before starting a review.</p>
      )}
      {phrasebooks.length > 0 && totalEntries === 0 && (
        <p className={styles.emptyNote}>This phrasebook has no entries yet.</p>
      )}
    </div>
  );
}
