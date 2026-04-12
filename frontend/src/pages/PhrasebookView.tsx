import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import EntryForm, { type EntryFormData } from '../components/entry/EntryForm';
import EntryList from '../components/entry/EntryList';
import QuotaIndicator from '../components/entry/QuotaIndicator';
import { API_BASE } from '../config/env';
import {
  createEntry,
  deleteEntry,
  deletePhrasebook,
  getEntriesByPhrasebook,
  getPhrasebook,
  updateEntry,
  type DBEntry,
} from '../services/db';
import { enqueueMutation } from '../services/sync';
import { randomUUID } from '../utils/uuid';
import styles from './PhrasebookView.module.css';

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
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      learningState: data.learningState,
      createdAt: now,
      updatedAt: now,
    };

    await createEntry(newEntry);
    await enqueueMutation(`${API_BASE}/entries`, 'POST', newEntry);
  }

  async function handleEditEntry(data?: EntryFormData) {
    const entry = editingEntry;
    setEditingEntry(null);
    if (!data || !entry) return;

    const changes = {
      sourceText: data.sourceText,
      targetText: data.targetText || undefined,
      notes: data.notes || undefined,
      tags: data.tags,
      partOfSpeech: data.partOfSpeech || undefined,
      learningState: data.learningState,
    };
    await updateEntry(entry.id, changes);
    await enqueueMutation(`${API_BASE}/entries/${entry.id}`, 'PUT', { ...entry, ...changes });
  }

  async function handleDeleteEntry(entry: DBEntry) {
    await deleteEntry(entry.id);
    await enqueueMutation(`${API_BASE}/entries/${entry.id}`, 'DELETE');
  }

  async function handleDeletePhrasebook() {
    if (!id) return;
    await deletePhrasebook(id);
    await enqueueMutation(`${API_BASE}/phrasebooks/${id}`, 'DELETE');
    navigate('/');
  }

  return (
    <main className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link to="/" className={styles.backLink}>← Phrasebooks</Link>
        </div>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{phrasebook.name}</h1>
          <button
            className={styles.deletePhrasebookBtn}
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete phrasebook"
          >
            Delete
          </button>
        </div>
        <p className={styles.langs}>
          {phrasebook.sourceLanguageName} → {phrasebook.targetLanguageName}
          <span className={styles.entryCount}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        </p>
        <QuotaIndicator />
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true">
          <div className={styles.confirmBox}>
            <p>Delete <strong>{phrasebook.name}</strong> and all its entries? This cannot be undone.</p>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className={styles.confirmDeleteBtn} onClick={handleDeletePhrasebook}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit entry form */}
      {(showEntryForm || editingEntry) && (
        <div className={styles.formWrapper}>
          <EntryForm
            onDone={editingEntry ? handleEditEntry : handleNewEntry}
            initialValues={editingEntry ?? undefined}
          />
        </div>
      )}

      {/* FAB — add entry */}
      {!showEntryForm && !editingEntry && (
        <button className={styles.fab} onClick={() => setShowEntryForm(true)} aria-label="Add entry">
          +
        </button>
      )}

      {/* Entry list */}
      <EntryList
        entries={entries}
        onEdit={(entry) => { setShowEntryForm(false); setEditingEntry(entry); }}
        onDelete={handleDeleteEntry}
      />
    </main>
  );
}
