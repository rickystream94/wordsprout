import { useState } from 'react';
import { getEnrichment, upsertEnrichment, updateEntry, type DBEnrichment, type DBEntry } from '../../services/db';
import { enrichApi } from '../../services/api';
import { usePendingIds } from '../../services/sync';
import { scoreToRange } from '../../services/scoring';
import { FEATURES_AI_ENABLED } from '../../config/env';
import EnrichmentPanel from './EnrichmentPanel';
import QuotaIndicator from './QuotaIndicator';
import LearningScoreBar from './LearningScoreBar';
import ConfirmDialog from '../common/ConfirmDialog';
import styles from './EntryList.module.css';

interface EntryListProps {
  entries: DBEntry[];
  onEdit?: (entry: DBEntry, enrichment?: DBEnrichment) => void;
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
  const pendingIds = usePendingIds();

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
          isPending={pendingIds.has(entry.id)}
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
  entry: initialEntry,
  isExpanded,
  isOnline,
  isPending,
  phrasebookName,
  onToggle,
  onEdit,
  onDelete,
}: {
  entry: DBEntry;
  isExpanded: boolean;
  isOnline: boolean;
  isPending: boolean;
  phrasebookName?: string;
  onToggle: () => void;
  onEdit?: (entry: DBEntry, enrichment?: DBEnrichment) => void;
  onDelete?: (entry: DBEntry) => void;
}) {
  const [entry, setEntry] = useState(initialEntry);
  const [enrichment, setEnrichment] = useState<DBEnrichment | undefined>(undefined);
  const [enrichmentLoaded, setEnrichmentLoaded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingReEnrich, setConfirmingReEnrich] = useState(false);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // Keep entry in sync with parent prop
  if (initialEntry.updatedAt !== entry.updatedAt && initialEntry.id === entry.id) {
    setEntry(initialEntry);
  }

  async function handleToggle() {
    if (!isExpanded && !enrichmentLoaded) {
      const stored = await getEnrichment(entry.id);
      setEnrichment(stored);
      setEnrichmentLoaded(true);
    }
    onToggle();
  }

  async function handleEnrich() {
    // If enrichment already exists, require confirmation first
    if (enrichment?.generatedAt && !confirmingReEnrich) {
      setConfirmingReEnrich(true);
      return;
    }
    setConfirmingReEnrich(false);
    setEnrichLoading(true);
    setEnrichError(null);
    try {
      const result = await enrichApi.enrich(entry.id, entry.sourceText, entry.targetText);
      const enrichmentData = result.enrichment ?? result;
      await upsertEnrichment(enrichmentData);
      setEnrichment(enrichmentData);

      // If AI provided updates to the entry (translation, partOfSpeech), apply them
      if (result.entry) {
        const updatedEntry = result.entry;
        const entryChanges: Partial<DBEntry> = { enrichmentId: enrichmentData.id };
        if (updatedEntry.targetText && !entry.targetText) entryChanges.targetText = updatedEntry.targetText;
        if (updatedEntry.partOfSpeech && !entry.partOfSpeech) entryChanges.partOfSpeech = updatedEntry.partOfSpeech;
        await updateEntry(entry.id, entryChanges);
        setEntry({ ...entry, ...entryChanges });
      } else if (!entry.enrichmentId) {
        await updateEntry(entry.id, { enrichmentId: enrichmentData.id });
        setEntry({ ...entry, enrichmentId: enrichmentData.id });
      }
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 429) {
        setEnrichError('Daily AI quota reached. Try again tomorrow.');
      } else if (e.statusCode === 503) {
        setEnrichError('AI service is temporarily unavailable. Please try again shortly.');
      } else {
        setEnrichError(e.message ?? 'Enrichment failed. Please try again.');
      }
    } finally {
      setEnrichLoading(false);
    }
  }

  const hasEnrichment = !!enrichment?.generatedAt;

  return (
    <li className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''} ${isPending ? styles.cardPending : ''}`}>
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
            enrichment={enrichment}
          />

          {enrichError && <p className={styles.enrichError}>{enrichError}</p>}

          {/* Actions bar */}
          <div className={styles.actions}>
            {/* Enrich / Re-enrich button */}
            <span
              className={styles.btnWrapper}
              title={!FEATURES_AI_ENABLED ? 'AI enrichment coming soon' : !isOnline ? 'Offline — connect to enrich' : undefined}
            >
                <button
                  className={styles.enrichBtn}
                  onClick={(e) => { e.stopPropagation(); handleEnrich(); }}
                  disabled={!FEATURES_AI_ENABLED || !isOnline || enrichLoading}
                  aria-busy={enrichLoading}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7.53 1.282a.5.5 0 0 1 .94 0l1.363 3.738 3.738 1.363a.5.5 0 0 1 0 .94l-3.738 1.363-1.363 3.738a.5.5 0 0 1-.94 0L6.167 8.686 2.43 7.323a.5.5 0 0 1 0-.94l3.738-1.363zM2.5 1a.5.5 0 0 1 .5.5v1h1a.5.5 0 0 1 0 1H3v1a.5.5 0 0 1-1 0V3.5h-1a.5.5 0 0 1 0-1H2v-1A.5.5 0 0 1 2.5 1zm10 9a.5.5 0 0 1 .5.5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1a.5.5 0 0 1 .5-.5z"/></svg>
                  {enrichLoading ? (hasEnrichment ? 'Regenerating…' : 'Enriching…') : (hasEnrichment ? 'Re-enrich' : 'Enrich')}
                </button>
              </span>

            {/* Re-enrich confirmation dialog */}
            {confirmingReEnrich && (
              <ConfirmDialog
                message="Re-enriching will overwrite all AI-generated fields. Manual edits will be lost."
                confirmLabel="Re-enrich"
                variant="danger"
                onConfirm={() => handleEnrich()}
                onCancel={() => setConfirmingReEnrich(false)}
              />
            )}

            {onEdit && (
              <button
                className={styles.actionBtn}
                onClick={(e) => { e.stopPropagation(); onEdit(entry, enrichment); }}
                aria-label="Edit entry"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61a.75.75 0 0 1-.38.2l-3.5.7a.75.75 0 0 1-.88-.88l.7-3.5a.75.75 0 0 1 .2-.38l8.61-8.61zm1.414 1.06a.25.25 0 0 0-.354 0L3 11.56v1.44h1.44L13.5 3.96l-1.086-1.06z"/></svg>
                Edit
              </button>
            )}
            {onDelete && (
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
              <ConfirmDialog
                message="Delete this entry? This cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => onDelete(entry)}
                onCancel={() => setConfirmingDelete(false)}
              />
            )}
          </div>

          <QuotaIndicator />
        </div>
      )}
    </li>
  );
}
