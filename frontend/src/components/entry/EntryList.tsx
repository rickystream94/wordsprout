import { useState } from 'react';
import { getEnrichment, updateEntry, type DBEnrichment, type DBEntry } from '../../services/db';
import { enqueueMutation } from '../../services/sync';
import type { LearningState } from '../../types/models';
import { API_BASE } from '../../config/env';
import EnrichmentPanel from './EnrichmentPanel';
import LearningStateToggle from './LearningStateToggle';
import styles from './EntryList.module.css';

interface EntryListProps {
  entries: DBEntry[];
  onEdit?: (entry: DBEntry) => void;
  onDelete?: (entry: DBEntry) => void;
}

const STATE_LABELS: Record<LearningState, string> = {
  new: 'New',
  learning: 'Learning',
  mastered: 'Mastered',
};

export default function EntryList({ entries, onEdit, onDelete }: EntryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isOnline = navigator.onLine;

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        <span aria-hidden="true" className={styles.emptyIcon}>✏️</span>
        <p>No entries yet. Add your first word or phrase above.</p>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {entries.map((entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          isExpanded={expandedId === entry.id}
          isOnline={isOnline}
          onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function EntryCard({
  entry,
  isExpanded,
  isOnline,
  onToggle,
  onEdit,
  onDelete,
}: {
  entry: DBEntry;
  isExpanded: boolean;
  isOnline: boolean;
  onToggle: () => void;
  onEdit?: (entry: DBEntry) => void;
  onDelete?: (entry: DBEntry) => void;
}) {
  const [enrichment, setEnrichment] = useState<DBEnrichment | undefined>(undefined);
  const [enrichmentLoaded, setEnrichmentLoaded] = useState(false);

  async function handleToggle() {
    if (!isExpanded && !enrichmentLoaded) {
      const stored = await getEnrichment(entry.id);
      setEnrichment(stored);
      setEnrichmentLoaded(true);
    }
    onToggle();
  }

  async function handleStateChange(newState: LearningState) {
    await updateEntry(entry.id, { learningState: newState });
    await enqueueMutation(`${API_BASE}/entries/${entry.id}`, 'PUT', { ...entry, learningState: newState });
  }

  return (
    <li className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''}`}>
      <div
        className={styles.cardMain}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
      >
        <div className={styles.texts}>
          <span className={styles.source}>{entry.sourceText}</span>
          {entry.targetText && (
            <span className={styles.target}>→ {entry.targetText}</span>
          )}
        </div>

        <div className={styles.meta}>
          <span className={`${styles.stateBadge} ${styles[`state_${entry.learningState}`]}`}>
            {STATE_LABELS[entry.learningState]}
          </span>
          {entry.partOfSpeech && (
            <span className={styles.posBadge}>{entry.partOfSpeech.replace('_', ' ')}</span>
          )}
        </div>

        {entry.notes && <p className={styles.notes}>{entry.notes}</p>}

        {entry.tags.length > 0 && (
          <div className={styles.tags}>
            {entry.tags.map((tag) => (
              <span key={tag} className={styles.tag}>#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className={styles.expanded}>
          {/* Learning state toggle */}
          <div className={styles.stateRow}>
            <span className={styles.stateRowLabel}>Learning state</span>
            <LearningStateToggle
              value={entry.learningState}
              onChange={handleStateChange}
              compact
            />
          </div>

          <EnrichmentPanel
            entryId={entry.id}
            enrichment={enrichment}
            isOnline={isOnline}
            onEnriched={(e) => setEnrichment(e)}
          />

          {(onEdit || onDelete) && (
            <div className={styles.actions}>
              {onEdit && (
                <button
                  className={styles.actionBtn}
                  onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
                  aria-label="Edit entry"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
                  aria-label="Delete entry"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
