import { useState } from 'react';
import type { DBEntry } from '../../services/db';
import type { LearningState } from '../../types/models';
import LearningStateToggle from './LearningStateToggle';
import styles from './ReviewCard.module.css';

interface ReviewCardProps {
  entry: DBEntry;
  onStateChange: (entry: DBEntry, newState: LearningState) => void;
}

export default function ReviewCard({ entry, onStateChange }: ReviewCardProps) {
  const [revealed, setRevealed] = useState(false);

  function handleReveal() {
    setRevealed(true);
  }

  return (
    <div className={styles.card}>
      <div className={styles.front}>
        <p className={styles.sourceText}>{entry.sourceText}</p>
        {entry.notes && !revealed && (
          <p className={styles.hint}>(tap to reveal)</p>
        )}
      </div>

      {!revealed ? (
        <button
          type="button"
          className={styles.revealBtn}
          onClick={handleReveal}
        >
          Reveal
        </button>
      ) : (
        <div className={styles.back}>
          {entry.targetText && (
            <p className={styles.targetText}>{entry.targetText}</p>
          )}
          {entry.notes && (
            <p className={styles.notes}>{entry.notes}</p>
          )}
          {entry.tags.length > 0 && (
            <div className={styles.tags}>
              {entry.tags.map((tag) => (
                <span key={tag} className={styles.tag}>#{tag}</span>
              ))}
            </div>
          )}
          <div className={styles.stateSection}>
            <span className={styles.stateLabel}>How did it go?</span>
            <LearningStateToggle
              value={entry.learningState}
              onChange={(newState) => onStateChange(entry, newState)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
