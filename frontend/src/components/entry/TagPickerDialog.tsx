import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_TAGS_PER_ENTRY, normalizeTag } from '../../utils/tags';
import styles from './TagPickerDialog.module.css';

interface TagPickerDialogProps {
  availableTags: string[];
  selectedTags: string[];
  maxTags?: number;
  onApply: (tags: string[]) => void;
  onCancel: () => void;
}

export default function TagPickerDialog({
  availableTags,
  selectedTags,
  maxTags = MAX_TAGS_PER_ENTRY,
  onApply,
  onCancel,
}: TagPickerDialogProps) {
  const [draft, setDraft] = useState(() => [...selectedTags]);
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allTags = useMemo(
    () => [...new Set([...availableTags, ...draft])].sort((a, b) => a.localeCompare(b)),
    [availableTags, draft],
  );
  const normalizedQuery = normalizeTag(query);
  const filteredTags = allTags.filter(tag => tag.includes(normalizedQuery));
  const canCreate = normalizedQuery.length > 0 && !allTags.includes(normalizedQuery);
  const atLimit = draft.length >= maxTags;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    searchRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  function toggleTag(tag: string) {
    setDraft(current => current.includes(tag)
      ? current.filter(value => value !== tag)
      : current.length < maxTags
        ? [...current, tag]
        : current);
  }

  function createTag() {
    if (!canCreate || atLimit) return;
    setDraft(current => [...current, normalizedQuery]);
    setQuery('');
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-picker-title"
      >
        <header className={styles.header}>
          <div>
            <h2 id="tag-picker-title" className={styles.title}>Choose tags</h2>
            <p className={styles.count}>{draft.length} of {maxTags} selected</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onCancel} aria-label="Close tag picker">×</button>
        </header>

        <div className={styles.searchArea}>
          <label htmlFor="tag-picker-search" className={styles.searchLabel}>Search or create a tag</label>
          <input
            ref={searchRef}
            id="tag-picker-search"
            className={styles.searchInput}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && canCreate && !atLimit) {
                event.preventDefault();
                createTag();
              }
            }}
            autoComplete="off"
          />
        </div>

        <div className={styles.results} role="listbox" aria-multiselectable="true" aria-label="Available tags">
          {canCreate && (
            <button type="button" className={styles.createButton} onClick={createTag} disabled={atLimit}>
              Create #{normalizedQuery}
            </button>
          )}
          {filteredTags.map(tag => {
            const selected = draft.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${styles.tagOption} ${selected ? styles.selected : ''}`}
                onClick={() => toggleTag(tag)}
                disabled={!selected && atLimit}
              >
                <span className={styles.checkbox} aria-hidden="true">{selected ? '✓' : ''}</span>
                <span>#{tag}</span>
              </button>
            );
          })}
          {!canCreate && filteredTags.length === 0 && (
            <p className={styles.empty}>No matching tags</p>
          )}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>Cancel</button>
          <button type="button" className={styles.applyButton} onClick={() => onApply(draft)}>Apply tags</button>
        </footer>
      </div>
    </div>
  );
}