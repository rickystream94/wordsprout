import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import PhrasebookForm, { type PhrasebookFormData } from '../components/phrasebook/PhrasebookForm';
import { API_BASE } from '../config/env';
import { createPhrasebook, getPhrasebooks, type DBPhrasebook } from '../services/db';
import { enqueueMutation } from '../services/sync';
import { randomUUID } from '../utils/uuid';
import styles from './Home.module.css';

export default function Home() {
  const { userId } = useAuth();
  const phrasebooks = useLiveQuery(
    () => (userId ? getPhrasebooks(userId) : Promise.resolve([])),
    [userId],
  );
  const [showNewForm, setShowNewForm] = useState(false);

  const loading = phrasebooks === undefined;

  async function handleNewPhrasebook(data?: PhrasebookFormData) {
    setShowNewForm(false);
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
    await createPhrasebook(pb);
    await enqueueMutation(`${API_BASE}/phrasebooks`, 'POST', pb);
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Phrasebooks</h1>
        <button className={styles.newBtn} onClick={() => setShowNewForm(true)}>
          + New Phrasebook
        </button>
      </div>

      {showNewForm && (
        <div className={styles.formWrapper}>
          <PhrasebookForm onDone={handleNewPhrasebook} />
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>Loading…</p>
      ) : phrasebooks.length === 0 ? (
        <EmptyState onNew={() => setShowNewForm(true)} />
      ) : (
        <ul className={styles.grid}>
          {phrasebooks.map((pb) => (
            <PhrasebookCard key={pb.id} phrasebook={pb} />
          ))}
        </ul>
      )}
    </main>
  );
}

function PhrasebookCard({ phrasebook }: { phrasebook: DBPhrasebook }) {
  return (
    <li className={styles.card}>
      <Link to={`/phrasebooks/${phrasebook.id}`} className={styles.cardLink}>
        <div className={styles.cardBody}>
          <h2 className={styles.cardName}>{phrasebook.name}</h2>
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

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon} aria-hidden="true">📖</div>
      <h2 className={styles.emptyTitle}>No phrasebooks yet</h2>
      <p className={styles.emptyDesc}>
        Create your first phrasebook to start capturing vocabulary.
      </p>
      <button className={styles.emptyBtn} onClick={onNew}>
        Create your first phrasebook
      </button>
    </div>
  );
}
