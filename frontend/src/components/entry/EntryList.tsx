import { useState } from 'react';
import { getEnrichment, type DBEnrichment, type DBEntry } from '../../services/db';
import { scoreToRange } from '../../services/scoring';
import EnrichmentPanel from './EnrichmentPanel';
import LearningScoreBar from './LearningScoreBar';
import styles from './EntryList.module.css';

interface EntryListProps {
  entries: DBEntry[];
  onEdit?: (entry: DBEntry) => void;
  onDelete?: (entry: DBEntry) => void;
  /** Optional id→name map; when provided each card shows its phrasebook name */
  phrasebooks?: Record<string, string>;
}

const DATE_FMT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
function formatDate(iso: string): string {
  try { return DATE_FMT.format(new Date(iso)); } catch { return ''; }
}

export default function EntryList({ entries, onEdit, onDelete, phrasebooks }: EntryListProps) {
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
          phrasebookName={phrasebooks?.[entry.phrasebookId]}
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
  phrasebookName,
  onToggle,
  onEdit,
  onDelete,
}: {
  entry: DBEntry;
  isExpanded: boolean;
  isOnline: boolean;
  phrasebookName?: string;
  onToggle: () => void;
  onEdit?: (entry: DBEntry) => void;
  onDelete?: (entry: DBEntry) => void;
}) {
  const [enrichment, setEnrichment] = useState<DBEnrichment | undefined>(undefined);
  const [enrichmentLoaded, setEnrichmentLoaded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleToggle() {
    if (!isExpanded && !enrichmentLoaded) {
      const stored = await getEnrichment(entry.id);
      setEnrichment(stored);
      setEnrichmentLoaded(true);
    }
    onToggle();
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
          {phrasebookName && (
            <span className={styles.phrasebookBadge}>{phrasebookName}</span>
          )}
          <span className={`${styles.stateBadge} ${styles[`state_${scoreToRange(entry.learningScore)}`]}`}>
            {{ dormant: '🌑 Dormant', sprouting: '🌱 Sprouting', echoing: '💬 Echoing', inscribed: '✏️ Inscribed', engraved: '🧠 Engraved' }[scoreToRange(entry.learningScore)]}
          </span>
          {entry.partOfSpeech && (
            <span className={styles.posBadge}>{entry.partOfSpeech.replace('_', ' ')}</span>
          )}
          <span className={styles.createdAt}>{formatDate(entry.createdAt)}</span>
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
          {/* Learning score bar */}
          <div className={styles.stateRow}>
            <span className={styles.stateRowLabel}>Learning score</span>
            <LearningScoreBar score={entry.learningScore} />
          </div>

          <EnrichmentPanel
            entryId={entry.id}
            enrichment={enrichment}
            isOnline={isOnline}
            onEnriched={(e) => setEnrichment(e)}
          />

          {(onEdit || onDelete) && (
            <div className={styles.actions}>
              {onEdit && !confirmingDelete && (
                <button
                  className={styles.actionBtn}
                  onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
                  aria-label="Edit entry"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61a.75.75 0 0 1-.38.2l-3.5.7a.75.75 0 0 1-.88-.88l.7-3.5a.75.75 0 0 1 .2-.38l8.61-8.61zm1.414 1.06a.25.25 0 0 0-.354 0L3 11.56v1.44h1.44L13.5 3.96l-1.086-1.06z"/></svg>
                  Edit
                </button>
              )}
              {onDelete && !confirmingDelete && (
                <button
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true); }}
                  aria-label="Delete entry"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15Z"/></svg>
                  Delete
                </button>
              )}
              {onDelete && confirmingDelete && (
                <div className={styles.confirmRow} onClick={(e) => e.stopPropagation()}>
                  <span className={styles.confirmText}>Delete this entry?</span>
                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={() => onDelete(entry)}
                  >
                    Yes, delete
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
