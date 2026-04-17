import DOMPurify from 'dompurify';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import type { DBEntry } from '../../services/db';
import { getTagSuggestions } from '../../services/db';
import type { PartOfSpeech } from '../../types/models';
import PartOfSpeechSelector from './PartOfSpeechSelector';
import TagInput from './TagInput';
import styles from './EntryForm.module.css';

export interface EntryFormData {
  sourceText: string;
  targetText: string;
  notes: string;
  partOfSpeech: PartOfSpeech | '';
  tags: string[];
}

interface EntryFormProps {
  onDone: (data?: EntryFormData) => void;
  initialValues?: Partial<DBEntry>;
  /** Existing entries in the same phrasebook — used for duplicate detection */
  existingEntries?: DBEntry[];
}

function sanitise(text: string): string {
  return DOMPurify.sanitize(text).trim();
}

/**
 * Normalize vocabulary text for storage and duplicate detection:
 * lowercase, trim, collapse spaces, strip leading/trailing non-word punctuation.
 * Preserves Unicode letters, numbers, apostrophes, hyphens and diacritics.
 * Does NOT touch notes — those remain free text.
 */
function normalizeEntryText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    // Strip leading/trailing chars that are not Unicode letters, digits, apostrophe or hyphen
    .replace(/^[^\p{L}\p{N}'\-]+|[^\p{L}\p{N}'\-]+$/gu, '')
    .toLowerCase();
}

export default function EntryForm({ onDone, initialValues, existingEntries }: EntryFormProps) {
  const { userId } = useAuth();
  const [sourceText, setSourceText] = useState(initialValues?.sourceText ?? '');
  const [targetText, setTargetText] = useState(initialValues?.targetText ?? '');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech | ''>(
    initialValues?.partOfSpeech ?? '',
  );
  const [tags, setTags] = useState<string[]>(initialValues?.tags ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tagSuggestions = useLiveQuery(
    () => (userId ? getTagSuggestions(userId) : Promise.resolve([])),
    [userId],
    [],
  );

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!sourceText.trim()) errs['sourceText'] = 'Source text is required';
    if (!targetText.trim()) errs['targetText'] = 'Target text is required';

    if (existingEntries && !errs['sourceText'] && !errs['targetText']) {
      const selfId = initialValues?.id;
      const normSrc = normalizeEntryText(sanitise(sourceText));
      const normTgt = normalizeEntryText(sanitise(targetText));

      const dupSrc = existingEntries.find(
        (e) => e.id !== selfId && normalizeEntryText(e.sourceText) === normSrc,
      );
      if (dupSrc) {
        errs['sourceText'] = `An entry with this source text already exists. Consider editing “${dupSrc.sourceText}” to add synonyms instead.`;
      }

      if (!errs['sourceText']) {
        const dupTgt = existingEntries.find(
          (e) => e.id !== selfId && !!e.targetText && normalizeEntryText(e.targetText) === normTgt,
        );
        if (dupTgt) {
          errs['targetText'] = `An entry with this translation already exists. Consider editing “${dupTgt.sourceText}” to add synonyms instead.`;
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onDone({
      sourceText: normalizeEntryText(sanitise(sourceText)),
      targetText: normalizeEntryText(sanitise(targetText)),
      notes: sanitise(notes),
      partOfSpeech,
      tags,
    });
  }

  const isEditing = !!initialValues?.id;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h3 className={styles.heading}>{isEditing ? 'Edit entry' : 'Add entry'}</h3>

      {/* Source text */}
      <div className={styles.field}>
        <label htmlFor="entry-source" className={styles.label}>
          Source text <span className={styles.required}>*</span>
        </label>
        <input
          id="entry-source"
          className={`${styles.input} ${errors['sourceText'] ? styles.inputError : ''}`}
          type="text"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="e.g. serendipity"
          maxLength={500}
          autoFocus
        />
        {errors['sourceText'] && <p className={styles.errorMsg}>{errors['sourceText']}</p>}
      </div>

      {/* Target text */}
      <div className={styles.field}>
        <label htmlFor="entry-target" className={styles.label}>
          Target text <span className={styles.required}>*</span>
        </label>
        <input
          id="entry-target"
          className={`${styles.input} ${errors['targetText'] ? styles.inputError : ''}`}
          type="text"
          value={targetText}
          onChange={(e) => setTargetText(e.target.value)}
          placeholder="e.g. serendipità"
          maxLength={500}
        />
        {errors['targetText'] && <p className={styles.errorMsg}>{errors['targetText']}</p>}
      </div>

      {/* Notes */}
      <div className={styles.field}>
        <label htmlFor="entry-notes" className={styles.label}>
          Notes <span className={styles.optional}>(optional)</span>
        </label>
        <textarea
          id="entry-notes"
          className={styles.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Context, memory hooks, usage examples…"
          maxLength={2000}
          rows={3}
        />
      </div>

      {/* Part of speech */}
      <div className={styles.field}>
        <span className={styles.label}>Part of speech</span>
        <PartOfSpeechSelector value={partOfSpeech} onChange={setPartOfSpeech} />
      </div>

      {/* Tags */}
      <div className={styles.field}>
        <label className={styles.label}>Tags</label>
        <TagInput tags={tags} onChange={setTags} suggestions={tagSuggestions ?? []} />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={() => onDone()}>
          Cancel
        </button>
        <button type="submit" className={styles.submitBtn}>
          {isEditing ? 'Save changes' : 'Add entry'}
        </button>
      </div>
    </form>
  );
}
