import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DBPhrasebook } from '../../services/db';
import type { PartOfSpeech } from '../../types/models';
import { SortDropdown } from '../search/SortDropdown';
import styles from './SessionSetup.module.css';

export type SessionType = 'random' | 'targeted';
export type ReviewMode = 'competitive' | 'rehearse';

// All possible PartOfSpeech values for the filter checkboxes
const ALL_POS_VALUES: PartOfSpeech[] = [
  'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition',
  'conjunction', 'article', 'interjection', 'numeral', 'idiom',
  'phrasal_verb', 'expression', 'other',
];

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
  const effectiveSize = Math.min(filtersActive ? filteredCount : actualSize, filtersActive ? filteredCount : totalEntries);

  function handlePhrasebookChange(id: string) {
    setSelectedPhrasebookId(id);
    setPosFilter([]);
    setTagFilter([]);
  }

  function togglePosFilter(pos: PartOfSpeech) {
    setPosFilter((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos],
    );
  }

  function toggleTagFilter(tag: string) {
    setTagFilter((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  const randomLabel = reviewMode === 'rehearse' ? 'Random sample' : 'Random';
  const targetedLabel = reviewMode === 'rehearse' ? 'Prioritise low score' : 'Targeted';
  const randomDesc = reviewMode === 'rehearse'
    ? 'Pick a random selection of entries'
    : 'Sample evenly from all entries';
  const targetedDesc = reviewMode === 'rehearse'
    ? 'Focus on entries with the lowest learning score'
    : 'Focus on entries with low score';

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
            <strong>{randomLabel}</strong>
            <span className={styles.typeDesc}>{randomDesc}</span>
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
            <strong>{targetedLabel}</strong>
            <span className={styles.typeDesc}>{targetedDesc}</span>
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

      {reviewMode === 'rehearse' && (
        <div className={styles.filterSection}>
          {availablePoS.length > 0 && (
            <div className={styles.filterGroup}>
              <span className={styles.label}>Filter by part of speech</span>
              <div className={styles.filterCheckboxes} role="group" aria-label="Part of speech filter">
                {ALL_POS_VALUES.map((pos) => (
                  <label
                    key={pos}
                    className={styles.filterChip}
                    style={{ opacity: availablePoS.includes(pos) ? 1 : 0.4 }}
                  >
                    <input
                      type="checkbox"
                      checked={posFilter.includes(pos)}
                      onChange={() => togglePosFilter(pos)}
                      disabled={!availablePoS.includes(pos)}
                    />
                    {pos}
                  </label>
                ))}
              </div>
            </div>
          )}

          {availableTags.length > 0 && (
            <div className={styles.filterGroup}>
              <span className={styles.label}>Filter by tag</span>
              <div className={styles.filterCheckboxes} role="group" aria-label="Tag filter">
                {availableTags.map((tag) => (
                  <label key={tag} className={styles.filterChip}>
                    <input
                      type="checkbox"
                      checked={tagFilter.includes(tag)}
                      onChange={() => toggleTagFilter(tag)}
                    />
                    {tag}
                  </label>
                ))}
              </div>
            </div>
          )}

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
