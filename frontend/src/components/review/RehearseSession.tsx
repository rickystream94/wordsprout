import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DBEntry, type DBEnrichment } from '../../services/db';
import { useSwipe } from '../../hooks/useSwipe';
import RehearseCard from './RehearseCard';
import styles from './RehearseSession.module.css';

interface RehearseSessionProps {
  entries: DBEntry[];
  onDone: () => void;
  targetLanguageName?: string;
  sourceLanguageName?: string;
}

export default function RehearseSession({ entries, onDone, targetLanguageName, sourceLanguageName }: RehearseSessionProps) {
  const [index, setIndex] = useState(0);

  const entryIds = entries.map((e) => e.id);
  const enrichments = useLiveQuery<DBEnrichment[]>(
    () => db.enrichments.where('entryId').anyOf(entryIds).toArray(),
    [entryIds.join(',')],
  ) ?? [];

  const enrichmentMap = new Map(enrichments.map((en) => [en.entryId, en]));

  function goNext() {
    if (index < entries.length - 1) {
      setIndex(index + 1);
    } else {
      onDone();
    }
  }

  function goPrev() {
    if (index > 0) {
      setIndex(index - 1);
    }
  }

  const swipeRef = useSwipe<HTMLDivElement>({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    }
  }

  const current = entries[index];

  return (
    <div
      ref={swipeRef}
      className={styles.session}
      role="region"
      aria-label="Rehearse session"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
    >
      <header className={styles.header}>
        <button type="button" className={styles.exitBtn} onClick={onDone} aria-label="Exit rehearse session">
          ← Exit
        </button>
        <span className={styles.progress} aria-live="polite">
          {index + 1} / {entries.length}
        </span>
        <span className={styles.rehearseBadge}>Rehearse — scores not affected</span>
      </header>

      <div className={styles.swipeHintLeft} aria-hidden="true">‹</div>
      <div className={styles.swipeHintRight} aria-hidden="true">›</div>

      {current && (
        <RehearseCard
          entry={current}
          enrichment={enrichmentMap.get(current.id)}
          targetLanguageName={targetLanguageName}
          sourceLanguageName={sourceLanguageName}
        />
      )}

      <nav className={styles.nav}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={goPrev}
          disabled={index === 0}
          aria-label="Go to previous card"
        >
          ← Prev
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={goNext}
          aria-label={index === entries.length - 1 ? 'Finish rehearse session' : 'Go to next card'}
        >
          {index === entries.length - 1 ? 'Finish' : 'Next →'}
        </button>
      </nav>
    </div>
  );
}
