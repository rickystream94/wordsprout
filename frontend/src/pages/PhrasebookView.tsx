import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import EntryForm, { type EntryFormData } from '../components/entry/EntryForm';
import EntryList from '../components/entry/EntryList';
import { SortDropdown } from '../components/search/SortDropdown';
import { API_BASE } from '../config/env';
import {
  createEntry,
  deleteEntry,
  deletePhrasebook,
  getEntriesByPhrasebook,
  getPhrasebook,
  updateEntry,
  updatePhrasebook,
  upsertEnrichment,
  type DBEntry,
  type DBEnrichment,
} from '../services/db';
import { enrichApi } from '../services/api';
import { enqueueMutation } from '../services/sync';
import { indexEntry, removeFromIndex } from '../services/search';
import { randomUUID } from '../utils/uuid';
import ConfirmDialog from '../components/common/ConfirmDialog';
import styles from './PhrasebookView.module.css';

type SortKey = 'createdAt_desc' | 'createdAt_asc' | 'sourceText_asc' | 'sourceText_desc' | 'targetText_asc' | 'targetText_desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'createdAt_desc', label: 'Newest first' },
  { value: 'createdAt_asc',  label: 'Oldest first' },
  { value: 'sourceText_asc',  label: 'Source A→Z' },
  { value: 'sourceText_desc', label: 'Source Z→A' },
  { value: 'targetText_asc',  label: 'Target A→Z' },
  { value: 'targetText_desc', label: 'Target Z→A' },
];

function applySortEntries(entries: DBEntry[], sort: SortKey): DBEntry[] {
  return [...entries].sort((a, b) => {
    switch (sort) {
      case 'createdAt_asc':  return a.createdAt.localeCompare(b.createdAt);
      case 'createdAt_desc': return b.createdAt.localeCompare(a.createdAt);
      case 'sourceText_asc': return a.sourceText.localeCompare(b.sourceText);
      case 'sourceText_desc': return b.sourceText.localeCompare(a.sourceText);
      case 'targetText_asc': return (a.targetText ?? '').localeCompare(b.targetText ?? '');
      case 'targetText_desc': return (b.targetText ?? '').localeCompare(a.targetText ?? '');
    }
  });
}

export default function PhrasebookView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();

  const phrasebook = useLiveQuery(() => (id ? getPhrasebook(id) : undefined), [id]);
  const entries = useLiveQuery(
    () => (id ? getEntriesByPhrasebook(id) : Promise.resolve([])),
    [id],
  );

  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DBEntry | null>(null);
  const [editingEnrichment, setEditingEnrichment] = useState<DBEnrichment | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<SortKey>('createdAt_desc');

  if (phrasebook === undefined || entries === undefined) {
    return <main className={styles.page}><p className={styles.loading}>Loading…</p></main>;
  }

  if (!phrasebook) {
    return (
      <main className={styles.page}>
        <p className={styles.notFound}>Phrasebook not found. <Link to="/">Go home</Link></p>
      </main>
    );
  }

  async function handleNewEntry(data?: EntryFormData) {
    setShowEntryForm(false);
    if (!data || !id || !userId) return;

    const now = new Date().toISOString();
    const newEntry: DBEntry = {
      id: randomUUID(),
      userId,
      phrasebookId: id,
      sourceText: data.sourceText,
      targetText: data.targetText || undefined,
      notes: data.notes || undefined,
      tags: data.tags,
      partOfSpeech: data.partOfSpeech || undefined,
      learningScore: 0,
      lastReviewedDate: null,
      createdAt: now,
      updatedAt: now,
    };

    await createEntry(newEntry);
    await enqueueMutation(`${API_BASE}/entries`, 'POST', newEntry);
    void indexEntry(newEntry);

    // Save enrichment if any fields were filled
    if (data.enrichment) {
      const e = data.enrichment;
      const hasContent = e.exampleSentences.length > 0 || e.synonyms.length > 0 ||
        e.antonyms.length > 0 || e.collocations.length > 0 || e.register || e.falseFriendWarning;
      if (hasContent) {
        const enrichmentId = `enrichment-${newEntry.id}`;
        const enrichmentDoc: DBEnrichment = {
          id: enrichmentId,
          userId,
          entryId: newEntry.id,
          exampleSentences: e.exampleSentences,
          synonyms: e.synonyms,
          antonyms: e.antonyms,
          collocations: e.collocations,
          register: e.register || undefined,
          falseFriendWarning: e.falseFriendWarning || undefined,
          editedAt: new Date().toISOString(),
        };
        await upsertEnrichment(enrichmentDoc);
        await updateEntry(newEntry.id, { enrichmentId });
        try {
          await enrichApi.patchEnrichment(newEntry.id, {
            exampleSentences: e.exampleSentences,
            synonyms: e.synonyms,
            antonyms: e.antonyms,
            collocations: e.collocations,
            register: e.register || undefined,
            falseFriendWarning: e.falseFriendWarning || undefined,
          });
        } catch {
          void enqueueMutation(`${API_BASE}/entries/${newEntry.id}/enrichment`, 'PATCH', {
            exampleSentences: e.exampleSentences,
            synonyms: e.synonyms,
            antonyms: e.antonyms,
            collocations: e.collocations,
            register: e.register || undefined,
            falseFriendWarning: e.falseFriendWarning || undefined,
          });
        }
      }
    }
  }

  async function handleEditEntry(data?: EntryFormData) {
    const entry = editingEntry;
    const prevEnrichment = editingEnrichment;
    setEditingEntry(null);
    setEditingEnrichment(undefined);
    if (!data || !entry) return;

    const changes = {
      sourceText: data.sourceText,
      targetText: data.targetText || undefined,
      notes: data.notes || undefined,
      tags: data.tags,
      partOfSpeech: data.partOfSpeech || undefined,
    };
    await updateEntry(entry.id, changes);
    await enqueueMutation(`${API_BASE}/entries/${entry.id}`, 'PUT', { ...entry, ...changes });
    void indexEntry({ ...entry, ...changes });

    // Save enrichment changes if present
    if (data.enrichment) {
      const enrichmentId = entry.enrichmentId ?? `enrichment-${entry.id}`;
      const enrichmentDoc: DBEnrichment = {
        id: enrichmentId,
        userId: entry.userId,
        entryId: entry.id,
        exampleSentences: data.enrichment.exampleSentences,
        synonyms: data.enrichment.synonyms,
        antonyms: data.enrichment.antonyms,
        collocations: data.enrichment.collocations,
        register: data.enrichment.register || undefined,
        falseFriendWarning: data.enrichment.falseFriendWarning || undefined,
        generatedAt: prevEnrichment?.generatedAt,
        editedAt: new Date().toISOString(),
      };
      await upsertEnrichment(enrichmentDoc);
      if (!entry.enrichmentId) {
        await updateEntry(entry.id, { enrichmentId });
      }
      try {
        await enrichApi.patchEnrichment(entry.id, {
          exampleSentences: data.enrichment.exampleSentences,
          synonyms: data.enrichment.synonyms,
          antonyms: data.enrichment.antonyms,
          collocations: data.enrichment.collocations,
          register: data.enrichment.register || undefined,
          falseFriendWarning: data.enrichment.falseFriendWarning || undefined,
        });
      } catch {
        void enqueueMutation(`${API_BASE}/entries/${entry.id}/enrichment`, 'PATCH', {
          exampleSentences: data.enrichment.exampleSentences,
          synonyms: data.enrichment.synonyms,
          antonyms: data.enrichment.antonyms,
          collocations: data.enrichment.collocations,
          register: data.enrichment.register || undefined,
          falseFriendWarning: data.enrichment.falseFriendWarning || undefined,
        });
      }
    }
  }

  async function handleDeleteEntry(entry: DBEntry) {
    await deleteEntry(entry.id);
    await enqueueMutation(`${API_BASE}/entries/${entry.id}`, 'DELETE');
    removeFromIndex(entry.id);
  }

  async function handleDeletePhrasebook() {
    if (!id) return;
    await deletePhrasebook(id);
    await enqueueMutation(`${API_BASE}/phrasebooks/${id}`, 'DELETE');
    navigate('/');
  }

  function startEditingName() {
    if (!phrasebook) return;
    setNameValue(phrasebook.name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  async function commitNameEdit() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== phrasebook?.name && id) {
      await updatePhrasebook(id, { name: trimmed });
      await enqueueMutation(`${API_BASE}/phrasebooks/${id}`, 'PATCH', { name: trimmed });
    }
    setEditingName(false);
  }

  return (
    <main className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link to="/" className={styles.backLink}>← Phrasebooks</Link>
        </div>
        <div className={styles.titleRow}>
          {editingName ? (
            <input
              ref={nameInputRef}
              className={styles.titleInput}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitNameEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitNameEdit(); }
                if (e.key === 'Escape') setEditingName(false);
              }}
              maxLength={120}
              aria-label="Phrasebook name"
            />
          ) : (
            <h1
              className={styles.title}
              onClick={startEditingName}
              title="Click to rename"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startEditingName(); }}
            >
              {phrasebook.name}
              <svg className={styles.editNameIcon} width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61a.75.75 0 0 1-.38.2l-3.5.7a.75.75 0 0 1-.88-.88l.7-3.5a.75.75 0 0 1 .2-.38l8.61-8.61zm1.414 1.06a.25.25 0 0 0-.354 0L3 11.56v1.44h1.44L13.5 3.96l-1.086-1.06z"/></svg>
            </h1>
          )}
          <button
            className={styles.deletePhrasebookBtn}
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete phrasebook"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15Z"/></svg>
            Delete phrasebook
          </button>
        </div>
        <p className={styles.langs}>
          {phrasebook.sourceLanguageName} → {phrasebook.targetLanguageName}
          <span className={styles.entryCount}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        </p>
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete "${phrasebook.name}" and its ${entries.length === 0 ? 'entries' : entries.length === 1 ? '1 entry' : `${entries.length} entries`}? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeletePhrasebook}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {/* Add / Edit entry form */}
      {(showEntryForm || editingEntry) && (
        <div className={styles.formWrapper}>
          <EntryForm
            onDone={editingEntry ? handleEditEntry : handleNewEntry}
            initialValues={editingEntry ?? undefined}
            initialEnrichment={editingEnrichment}
            existingEntries={entries}
            sourceLanguageName={phrasebook.sourceLanguageName}
            targetLanguageName={phrasebook.targetLanguageName}
          />
        </div>
      )}

      {/* FAB — add entry */}
      {!showEntryForm && !editingEntry && (
        <button className={styles.fab} onClick={() => setShowEntryForm(true)} aria-label="Add entry" title="Add new entry">
          +
        </button>
      )}

      {/* Entry list */}
      <div className={styles.listHeader}>
        <SortDropdown value={sort} options={SORT_OPTIONS} onChange={setSort} />
      </div>
      <EntryList
        entries={applySortEntries(entries, sort)}
        onEdit={(entry, enrichment) => { setShowEntryForm(false); setEditingEntry(entry); setEditingEnrichment(enrichment); }}
        onDelete={handleDeleteEntry}
      />
    </main>
  );
}
