import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import PhrasebookForm, { type PhrasebookFormData } from '../components/phrasebook/PhrasebookForm';
import TemplatePhrasebookWizard from '../components/phrasebook/TemplatePhrasebookWizard';
import { API_BASE } from '../config/env';
import { createPhrasebook, getPhrasebooks, updatePhrasebook, DuplicateLanguagePairError, type DBPhrasebook } from '../services/db';
import { enqueueMutation, usePendingIds } from '../services/sync';
import { randomUUID } from '../utils/uuid';
import styles from './Home.module.css';

export default function Home() {
  const { userId } = useAuth();
  const phrasebooks = useLiveQuery(
    () => (userId ? getPhrasebooks(userId) : Promise.resolve([])),
    [userId],
  );
  const [showNewForm, setShowNewForm] = useState(false);
  const [showTemplateWizard, setShowTemplateWizard] = useState(false);
  const [newFormError, setNewFormError] = useState<string | null>(null);

  const loading = phrasebooks === undefined;

  const existingTargetCodes = (phrasebooks ?? [])
    .filter((pb) => pb.sourceLanguageCode === 'en')
    .map((pb) => pb.targetLanguageCode);

  async function handleNewPhrasebook(data?: PhrasebookFormData) {
    setShowNewForm(false);
    setNewFormError(null);
    if (!data || !userId) return;

    const now = new Date().toISOString();
    const pb: DBPhrasebook = {
      id: randomUUID(),
      userId,
      name: data.name,
      sourceLanguageCode: data.sourceLanguageCode,
      sourceLanguageName: data.sourceLanguageName,
      targetLanguageCode: data.targetLanguageCode,
      targetLanguageName: data.targetLanguageName,
      entryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await createPhrasebook(pb);
      await enqueueMutation(`${API_BASE}/phrasebooks`, 'POST', pb);
    } catch (err) {
      if (err instanceof DuplicateLanguagePairError) {
        setShowNewForm(true);
        setNewFormError(err.message);
      } else {
        throw err;
      }
    }
  }

  function handleTemplateWizardDone(pb?: DBPhrasebook) {
    setShowTemplateWizard(false);
    void pb; // phrasebook is already in IndexedDB; useLiveQuery picks it up reactively
  }

  async function dismissTemplateBadge(pb: DBPhrasebook) {
    await updatePhrasebook(pb.id, { fromTemplate: false });
    await enqueueMutation(`${API_BASE}/phrasebooks/${pb.id}`, 'PUT', { ...pb, fromTemplate: false });
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Phrasebooks</h1>
        <div className={styles.headerActions}>
          <button className={styles.templateBtn} onClick={() => setShowTemplateWizard(true)}>
            From template
          </button>
          <button className={styles.newBtn} onClick={() => { setNewFormError(null); setShowNewForm(true); }}>
            + New Phrasebook
          </button>
        </div>
      </div>

      {showTemplateWizard && userId && (
        <div className={styles.formWrapper}>
          <TemplatePhrasebookWizard
            userId={userId}
            existingTargetCodes={existingTargetCodes}
            onDone={handleTemplateWizardDone}
          />
        </div>
      )}

      {showNewForm && (
        <div className={styles.formWrapper}>
          {newFormError && <p className={styles.duplicateError}>{newFormError}</p>}
          <PhrasebookForm onDone={handleNewPhrasebook} />
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>Loading…</p>
      ) : phrasebooks.length === 0 ? (
        <EmptyState onNew={() => { setNewFormError(null); setShowNewForm(true); }} onTemplate={() => setShowTemplateWizard(true)} />
      ) : (
        <ul className={styles.grid}>
          {phrasebooks.map((pb) => (
            <PhrasebookCard key={pb.id} phrasebook={pb} onDismissTemplate={dismissTemplateBadge} />
          ))}
        </ul>
      )}
    </main>
  );
}

function PhrasebookCard({
  phrasebook,
  onDismissTemplate,
}: {
  phrasebook: DBPhrasebook;
  onDismissTemplate: (pb: DBPhrasebook) => void;
}) {
  const pendingIds = usePendingIds();
  const isPending = pendingIds.has(phrasebook.id);
  return (
    <li className={`${styles.card} ${isPending ? styles.cardPending : ''}`}>
      <Link to={`/phrasebooks/${phrasebook.id}`} className={styles.cardLink}>
        <div className={styles.cardBody}>
          <div className={styles.cardNameRow}>
            <h2 className={styles.cardName}>{phrasebook.name}</h2>
            {phrasebook.fromTemplate === true && (
              <span className={styles.templateBadge}>
                Starter
                <button
                  className={styles.badgeDismiss}
                  aria-label="Remove Starter badge"
                  title="Remove Starter badge"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismissTemplate(phrasebook); }}
                >
                  ×
                </button>
              </span>
            )}
          </div>
          <p className={styles.cardLangs}>
            {phrasebook.sourceLanguageName} → {phrasebook.targetLanguageName}
          </p>
          <span className={styles.cardCount}>
            {phrasebook.entryCount} {phrasebook.entryCount === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </Link>
    </li>
  );
}

interface EmptyStateProps {
  onNew: () => void;
  onTemplate: () => void;
}

function EmptyState({ onNew, onTemplate }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon} aria-hidden="true">📖</div>
      <h2 className={styles.emptyTitle}>No phrasebooks yet</h2>
      <p className={styles.emptyDesc}>
        Start with a ready-made starter phrasebook, or create your own from scratch.
      </p>
      <button className={styles.emptyBtn} onClick={onTemplate}>
        Start from a template
      </button>
      <button className={styles.emptyBtnSecondary} onClick={onNew}>
        Create empty phrasebook
      </button>
    </div>
  );
}

