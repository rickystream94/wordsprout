import { useLiveQuery } from 'dexie-react-hooks';
import { useDeferredValue, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import EmptyState from '../components/common/EmptyState';
import EntryList from '../components/entry/EntryList';
import FilterPanel from '../components/search/FilterPanel';
import { EMPTY_FILTERS, type ActiveFilters } from '../components/search/filterTypes';
import SearchBar from '../components/search/SearchBar';
import { db, type DBEntry } from '../services/db';
import { searchIds } from '../services/search';
import styles from './Search.module.css';

export default function Search() {
  const { userId } = useAuth();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);

  const deferredQuery = useDeferredValue(query);

  const allEntries = useLiveQuery<DBEntry[]>(
    () => (userId ? db.entries.where('userId').equals(userId).toArray() : Promise.resolve([])),
    [userId],
    [],
  );

  const results = useMemo(() => {
    if (!allEntries) return [];
    let entries = allEntries;

    if (filters.phrasebookId) entries = entries.filter((e) => e.phrasebookId === filters.phrasebookId);
    if (filters.learningState) entries = entries.filter((e) => e.learningState === filters.learningState);
    if (filters.partOfSpeech) entries = entries.filter((e) => e.partOfSpeech === filters.partOfSpeech);
    if (filters.tag) entries = entries.filter((e) => e.tags.includes(filters.tag));

    if (deferredQuery.trim()) {
      const ids = searchIds(deferredQuery);
      entries = entries.filter((e) => ids.has(e.id));
    }

    return entries.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [allEntries, deferredQuery, filters]);

  const hasFilters = query.trim() || Object.values(filters).some(Boolean);
  const isEmpty = (allEntries ?? []).length === 0;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Search</h1>
      </div>

      <div className={styles.controls}>
        <SearchBar value={query} onChange={setQuery} />
        <FilterPanel filters={filters} onChange={setFilters} />
      </div>

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
        <EntryList entries={results} />
      )}
    </main>
  );
}
