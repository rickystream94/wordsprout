import { useEffect, useState } from 'react';
import type { DBPhrasebook } from '../../services/db';
import styles from './SessionSetup.module.css';

export type SessionType = 'random' | 'targeted';

interface SessionSetupProps {
  phrasebooks: DBPhrasebook[];
  onStart: (type: SessionType, size: number, phrasebookId: string) => void;
}

const SIZE_OPTIONS = [5, 10, 20, 50];

export default function SessionSetup({ phrasebooks, onStart }: SessionSetupProps) {
  const [sessionType, setSessionType] = useState<SessionType>('random');
  const [selectedPhrasebookId, setSelectedPhrasebookId] = useState<string>(
    phrasebooks[0]?.id ?? '',
  );

  // Initialise once data arrives from the async useLiveQuery
  useEffect(() => {
    if (!selectedPhrasebookId && phrasebooks.length > 0) {
      setSelectedPhrasebookId(phrasebooks[0].id);
    }
  }, [phrasebooks, selectedPhrasebookId]);
  const [size, setSize] = useState(10);

  const selectedPhrasebook = phrasebooks.find((p) => p.id === selectedPhrasebookId);
  const totalEntries = selectedPhrasebook?.entryCount ?? 0;
  const actualSize = Math.min(size, totalEntries);

  return (
    <div className={styles.setup}>
      <h2 className={styles.heading}>Start a review session</h2>

      <div className={styles.field}>
        <label htmlFor="session-phrasebook" className={styles.label}>Phrasebook</label>
        <select
          id="session-phrasebook"
          className={styles.phrasebookSelect}
          value={selectedPhrasebookId}
          onChange={(e) => setSelectedPhrasebookId(e.target.value)}
        >
          {phrasebooks.map((pb) => (
            <option key={pb.id} value={pb.id}>
              {pb.name} ({pb.entryCount} {pb.entryCount === 1 ? 'entry' : 'entries'})
            </option>
          ))}
        </select>
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
            <span className={styles.typeDesc}>Focus on entries with low score</span>
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
        {actualSize < size && (
          <p className={styles.sizeNote}>Only {totalEntries} entries available — using {actualSize}</p>
        )}
      </div>

      <button
        type="button"
        className={styles.startBtn}
        onClick={() => onStart(sessionType, actualSize, selectedPhrasebookId)}
        disabled={totalEntries === 0 || !selectedPhrasebookId}
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
