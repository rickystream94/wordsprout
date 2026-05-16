import { useLiveQuery } from 'dexie-react-hooks';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import EmptyState from '../components/common/EmptyState';
import EntryForm, { type EntryFormData } from '../components/entry/EntryForm';
import EntryList from '../components/entry/EntryList';
import FilterPanel from '../components/search/FilterPanel';
import { EMPTY_FILTERS, type ActiveFilters } from '../components/search/filterTypes';
import SearchBar from '../components/search/SearchBar';
import { SortDropdown } from '../components/search/SortDropdown';
import { API_BASE } from '../config/env';
import { db, deleteEntry, updateEntry, upsertEnrichment, type DBEntry, type DBEnrichment, type DBPhrasebook } from '../services/db';
import { enrichApi } from '../services/api';
import { enqueueMutation } from '../services/sync';
import { searchIds, substringMatch, indexEntry, removeFromIndex, rebuildIndex } from '../services/search';
import { scoreToRange } from '../services/scoring';
import styles from './Search.module.css';

type SortKey = 'createdAt_desc' | 'createdAt_asc' | 'sourceText_asc' | 'sourceText_desc' | 'targetText_asc' | 'targetText_desc';

/** Maximum number of entries rendered at once. Bounds DOM cost for power users. */
const RESULTS_DISPLAY_LIMIT = 200;

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
  const [editingEnrichment, setEditingEnrichment] = useState<DBEnrichment | undefined>(undefined);
  const [sort, setSort] = useState<SortKey>('createdAt_desc');
  const [showFilters, setShowFilters] = useState(false);

  const deferredQuery = useDeferredValue(query);

  const allEntries = useLiveQuery<DBEntry[]>(
    () => (userId ? db.entries.where('userId').equals(userId).toArray() : Promise.resolve([])),
    [userId],
  );

  const allPhrasebooks = useLiveQuery<DBPhrasebook[]>(
    () => (userId ? db.phrasebooks.where('userId').equals(userId).toArray() : Promise.resolve([])),
    [userId],
  );

  const allEnrichments = useLiveQuery<DBEnrichment[]>(
    () => (userId ? db.enrichments.where('userId').equals(userId).toArray() : Promise.resolve([])),
    [userId],
  );

  const synonymMap = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const e of allEnrichments ?? []) map[e.entryId] = e.synonyms;
    return map;
  }, [allEnrichments]);

  // Rebuild index once the user's entries have loaded (fixes empty-index-on-startup bug)
  const indexReady = useRef(false);
  useEffect(() => {
    if (!indexReady.current && userId && allEntries && allEntries.length > 0) {
      indexReady.current = true;
      rebuildIndex(userId).catch(console.error);
    }
  }, [userId, allEntries]);

  // Compute results inline — avoids stale-closure issues with useMemo + useLiveQuery
  const loadedEntries = allEntries ?? [];

  let results: DBEntry[] = loadedEntries;
  if (filters.phrasebookIds.length) results = results.filter((e) => filters.phrasebookIds.includes(e.phrasebookId));
  if (filters.scoreRanges.length) results = results.filter((e) => filters.scoreRanges.includes(scoreToRange(e.learningScore)));
  if (filters.partsOfSpeech.length) results = results.filter((e) => e.partOfSpeech != null && filters.partsOfSpeech.includes(e.partOfSpeech));
  if (filters.tags.length) results = results.filter((e) => filters.tags.some((t) => e.tags.includes(t)));
  if (deferredQuery.trim()) {
    const miniIds = searchIds(deferredQuery);
    const subIds = substringMatch(deferredQuery, loadedEntries, synonymMap);
    const combined = new Set([...miniIds, ...subIds]);
    results = results.filter((e) => combined.has(e.id));
  }
  results = applySortEntries(results, sort);

  const totalResultCount = results.length;
  const displayedResults =
    results.length > RESULTS_DISPLAY_LIMIT ? results.slice(0, RESULTS_DISPLAY_LIMIT) : results;

  // Build phrasebook id→name map; hide badge when exactly one phrasebook is selected
  const phrasebookMap = useMemo<Record<string, string>>(() => {
    if (filters.phrasebookIds.length === 1 || !allPhrasebooks) return {};
    return Object.fromEntries(allPhrasebooks.map((pb) => [pb.id, pb.name]));
  }, [allPhrasebooks, filters.phrasebookIds]);

  const activeFilterCount =
    filters.phrasebookIds.length +
    filters.scoreRanges.length +
    filters.partsOfSpeech.length +
    filters.tags.length;

  const hasFilters =
    query.trim() ||
    activeFilterCount > 0;
  const isEmpty = allEntries !== undefined && loadedEntries.length === 0;

  async function handleEditEntry(data?: EntryFormData) {
    const entry = editingEntry;
    const prevEnrichment = editingEnrichment;
    setEditingEntry(null);
    setEditingEnrichment(undefined);
    if (!data || !entry) return;

    const changes: Record<string, unknown> = {
      sourceText: data.sourceText,
      targetText: data.targetText || undefined,
      notes: data.notes || undefined,
      tags: data.tags,
      partOfSpeech: data.partOfSpeech || undefined,
    };

    // Save enrichment BEFORE entry update so it's in IndexedDB when
    // the live-query re-render triggers enrichment re-fetch in EntryCard
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
        changes.enrichmentId = enrichmentId;
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

    await updateEntry(entry.id, changes);
    await enqueueMutation(`${API_BASE}/entries/${entry.id}`, 'PUT', { ...entry, ...changes });
    void indexEntry({ ...entry, ...changes });
  }

  async function handleDeleteEntry(entry: DBEntry) {
    await deleteEntry(entry.id);
    await enqueueMutation(`${API_BASE}/entries/${entry.id}`, 'DELETE');
    removeFromIndex(entry.id);
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Search</h1>
      </div>

      <div className={styles.controls}>
        <SearchBar value={query} onChange={setQuery} />
        <div className={styles.controlsBar}>
          <button
            type="button"
            className={`${styles.filtersToggle} ${activeFilterCount > 0 ? styles.filtersToggleActive : ''}`}
            onClick={() => setShowFilters((f) => !f)}
            aria-expanded={showFilters}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75zm3 5A.75.75 0 0 1 4.75 7h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 4 7.75zm3 4.5a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75z" />
            </svg>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          <SortDropdown value={sort} options={SORT_OPTIONS} onChange={setSort} />
        </div>
        {showFilters && <FilterPanel filters={filters} onChange={setFilters} />}
      </div>

      {editingEntry && (
        <div className={styles.formWrapper}>
          <EntryForm
            onDone={handleEditEntry}
            initialValues={editingEntry}
            initialEnrichment={editingEnrichment}
            existingEntries={loadedEntries.filter((e) => e.phrasebookId === editingEntry.phrasebookId)}
            sourceLanguageName={allPhrasebooks?.find((pb) => pb.id === editingEntry.phrasebookId)?.sourceLanguageName}
            targetLanguageName={allPhrasebooks?.find((pb) => pb.id === editingEntry.phrasebookId)?.targetLanguageName}
          />
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
        <>
          {totalResultCount > RESULTS_DISPLAY_LIMIT && (
            <p className={styles.resultCapBanner}>
              Showing {RESULTS_DISPLAY_LIMIT.toLocaleString()} of {totalResultCount.toLocaleString()} results
              &nbsp;&mdash;&nbsp;refine your search to see more.
            </p>
          )}
          <EntryList
            entries={displayedResults}
            phrasebooks={phrasebookMap}
            onEdit={(entry, enrichment) => { setEditingEntry(entry); setEditingEnrichment(enrichment); }}
            onDelete={handleDeleteEntry}
          />
        </>
      )}
    </main>
  );
}
