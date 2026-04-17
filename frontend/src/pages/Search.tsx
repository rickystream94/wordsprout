import { useLiveQuery } from 'dexie-react-hooks';
import { useDeferredValue, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import EmptyState from '../components/common/EmptyState';
import EntryForm, { type EntryFormData } from '../components/entry/EntryForm';
import EntryList from '../components/entry/EntryList';
import FilterPanel from '../components/search/FilterPanel';
import { EMPTY_FILTERS, type ActiveFilters } from '../components/search/filterTypes';
import SearchBar from '../components/search/SearchBar';
import { API_BASE } from '../config/env';
import { db, deleteEntry, updateEntry, type DBEntry, type DBPhrasebook } from '../services/db';
import { enqueueMutation } from '../services/sync';
import { searchIds } from '../services/search';
import styles from './Search.module.css';

type SortOption = 'createdAt_desc' | 'createdAt_asc' | 'sourceText_asc' | 'sourceText_desc' | 'targetText_asc' | 'targetText_desc';

function applySortEntries(entries: DBEntry[], sort: SortOption): DBEntry[] {
  return [...entries].sort((a, b) => {
    switch (sort) {
      case 'createdAt_asc':   return a.createdAt.localeCompare(b.createdAt);
      case 'createdAt_desc':  return b.createdAt.localeCompare(a.createdAt);
      case 'sourceText_asc':  return a.sourceText.localeCompare(b.sourceText);
      case 'sourceText_desc': return b.sourceText.localeCompare(a.sourceText);
      case 'targetText_asc':  return (a.targetText ?? '').localeCompare(b.targetText ?? '');
      case 'targetText_desc': return (b.targetText ?? '').localeCompare(a.targetText ?? '');
    }
  });
}

export default function Search() {
  const { userId } = useAuth();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [editingEntry, setEditingEntry] = useState<DBEntry | null>(null);
  const [sort, setSort] = useState<SortOption>('createdAt_desc');

  const deferredQuery = useDeferredValue(query);

  const allEntries = useLiveQuery<DBEntry[]>(
    () => (userId ? db.entries.where('userId').equals(userId).toArray() : Promise.resolve([])),
    [userId],
  );

  const allPhrasebooks = useLiveQuery<DBPhrasebook[]>(
    () => (userId ? db.phrasebooks.where('userId').equals(userId).toArray() : Promise.resolve([])),
    [userId],
  );

  // Compute results inline — avoids stale-closure issues with useMemo + useLiveQuery
  const loadedEntries = allEntries ?? [];

  let results: DBEntry[] = loadedEntries;
  if (filters.phrasebookIds.length) results = results.filter((e) => filters.phrasebookIds.includes(e.phrasebookId));
  if (filters.learningStates.length) results = results.filter((e) => filters.learningStates.includes(e.learningState));
  if (filters.partsOfSpeech.length) results = results.filter((e) => e.partOfSpeech != null && filters.partsOfSpeech.includes(e.partOfSpeech));
  if (filters.tags.length) results = results.filter((e) => filters.tags.some((t) => e.tags.includes(t)));
  if (deferredQuery.trim()) {
    const ids = searchIds(deferredQuery);
    results = results.filter((e) => ids.has(e.id));
  }
  results = applySortEntries(results, sort);

  // Build phrasebook id→name map; hide badge when exactly one phrasebook is selected
  const phrasebookMap = useMemo<Record<string, string>>(() => {
    if (filters.phrasebookIds.length === 1 || !allPhrasebooks) return {};
    return Object.fromEntries(allPhrasebooks.map((pb) => [pb.id, pb.name]));
  }, [allPhrasebooks, filters.phrasebookIds]);

  const hasFilters =
    query.trim() ||
    filters.phrasebookIds.length > 0 ||
    filters.learningStates.length > 0 ||
    filters.partsOfSpeech.length > 0 ||
    filters.tags.length > 0;
  const isEmpty = allEntries !== undefined && loadedEntries.length === 0;

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

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Search</h1>
      </div>

      <div className={styles.controls}>
        <SearchBar value={query} onChange={setQuery} />
        <FilterPanel filters={filters} onChange={setFilters} />
      </div>

      <div className={styles.listHeader}>
        <span className={styles.sortLabel}>Sort by</span>
        <select
          className={styles.sortSelect}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          aria-label="Sort entries"
        >
          <option value="createdAt_desc">Newest first</option>
          <option value="createdAt_asc">Oldest first</option>
          <option value="sourceText_asc">Source A→Z</option>
          <option value="sourceText_desc">Source Z→A</option>
          <option value="targetText_asc">Target A→Z</option>
          <option value="targetText_desc">Target Z→A</option>
        </select>
      </div>

      {editingEntry && (
        <div className={styles.formWrapper}>
          <EntryForm onDone={handleEditEntry} initialValues={editingEntry} />
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon="📝"
          title="No entries yet"
          description="Add some vocabulary entries in a phrasebook first."
        />
      ) : results.length === 0 && hasFilters ? (
        <EmptyState
          icon="🔍"
          title="No results"
          description="Try different search terms or clear some filters."
          actionLabel="Clear filters"
          onAction={() => { setQuery(''); setFilters(EMPTY_FILTERS); }}
        />
      ) : (
        <EntryList
          entries={results}
          phrasebooks={phrasebookMap}
          onEdit={(entry) => setEditingEntry(entry)}
          onDelete={handleDeleteEntry}
        />
      )}
    </main>
  );
}
