import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../../auth/useAuth';
import ConfirmDialog from '../common/ConfirmDialog';
import { db, renameTag as dbRenameTag, deleteTag as dbDeleteTag } from '../../services/db';
import { tagsApi } from '../../services/api';
import styles from './TagManagerModal.module.css';

interface Props {
  onClose: () => void;
  onTagRenamed?: (oldTag: string, newTag: string) => void;
  onTagDeleted?: (tagName: string) => void;
}

interface TagRow {
  tag: string;
  count: number;
}

export default function TagManagerModal({ onClose, onTagRenamed, onTagDeleted }: Props) {
  const { userId } = useAuth();

  const tagRows = useLiveQuery<TagRow[]>(
    () =>
      userId
        ? db.entries
            .where('userId')
            .equals(userId)
            .toArray()
            .then((entries) => {
              const counts = new Map<string, number>();
              for (const e of entries) {
                for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
              }
              return [...counts.entries()]
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => a.tag.localeCompare(b.tag));
            })
        : Promise.resolve([]),
    [userId],
  );

  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busyTag, setBusyTag] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<TagRow | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const escapedRef = useRef(false);

  const isAnyBusy = busyTag !== null;

  useEffect(() => {
    if (editingTag !== null) inputRef.current?.focus();
  }, [editingTag]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && editingTag === null && !isAnyBusy) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, editingTag, isAnyBusy]);

  function startEditing(tag: string) {
    escapedRef.current = false;
    setEditingTag(tag);
    setDraft(tag);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[tag];
      return copy;
    });
  }

  async function commitRename() {
    if (!editingTag || !userId) return;
    const trimmed = draft.trim();
    const oldTag = editingTag;
    setEditingTag(null);
    if (!trimmed || trimmed === oldTag) return;

    setBusyTag(oldTag);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[oldTag];
      return copy;
    });
    try {
      await tagsApi.rename(oldTag, trimmed);
      await dbRenameTag(userId, oldTag, trimmed);
      onTagRenamed?.(oldTag, trimmed);
    } catch {
      setErrors((prev) => ({ ...prev, [oldTag]: 'Rename failed. Please try again.' }));
    } finally {
      setBusyTag(null);
    }
  }

  async function handleDeleteConfirm(tag: string) {
    if (!userId) return;
    setConfirmDelete(null);
    setBusyTag(tag);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[tag];
      return copy;
    });
    try {
      await tagsApi.delete(tag);
      await dbDeleteTag(userId, tag);
      onTagDeleted?.(tag);
    } catch {
      setErrors((prev) => ({ ...prev, [tag]: 'Delete failed. Please try again.' }));
    } finally {
      setBusyTag(null);
    }
  }

  return (
    <>
      <div className={styles.overlay} onClick={isAnyBusy ? undefined : onClose} role="presentation">
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tag-manager-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <h2 id="tag-manager-title" className={styles.title}>
              Manage Tags
            </h2>
            <div className={styles.headerEnd}>
              {isAnyBusy && (
                <span className={styles.spinner} aria-label="Updating tags…" role="status" />
              )}
              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close tag manager"
                disabled={isAnyBusy}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </button>
            </div>
            </div>

          {!tagRows || tagRows.length === 0 ? (
            <p className={styles.empty}>
              No tags yet. Add tags to vocabulary entries to see them here.
            </p>
          ) : (
            <ul className={styles.list} role="list">
              {tagRows.map(({ tag, count }) => {
                const isEditing = editingTag === tag;
                const isBusy = busyTag === tag;
                const error = errors[tag];
                return (
                  <li key={tag} className={`${styles.row} ${isBusy ? styles.rowBusy : ''}`}>
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        className={styles.editInput}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void commitRename();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            escapedRef.current = true;
                            setEditingTag(null);
                          }
                        }}
                        onBlur={() => {
                          if (!escapedRef.current) void commitRename();
                          escapedRef.current = false;
                        }}
                        maxLength={50}
                        aria-label={`Rename tag ${tag}`}
                      />
                    ) : (
                      <span className={styles.tagName}>#{tag}</span>
                    )}
                    <span className={styles.tagCount}>
                      {count} {count === 1 ? 'entry' : 'entries'}
                    </span>
                    {error && <span className={styles.rowError}>{error}</span>}
                    {!isEditing && (
                      <div className={styles.rowActions}>
                        <button
                          className={styles.iconBtn}
                          aria-label={`Rename tag ${tag}`}
                          disabled={busyTag !== null}
                          onClick={() => startEditing(tag)}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.81 3.361 11.2a.253.253 0 0 0-.064.108l-.618 2.163 2.162-.617a.253.253 0 0 0 .108-.064L11.19 6.25Z" />
                          </svg>
                        </button>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          aria-label={`Delete tag ${tag}`}
                          disabled={busyTag !== null}
                          onClick={() => setConfirmDelete({ tag, count })}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`Remove '#${confirmDelete.tag}' from ${confirmDelete.count} ${confirmDelete.count === 1 ? 'entry' : 'entries'}? This cannot be undone.`}
          confirmLabel="Delete tag"
          variant="danger"
          onConfirm={() => handleDeleteConfirm(confirmDelete.tag)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
