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
  /** Language names shown in field labels (e.g. "Italian", "English") */
  sourceLanguageName?: string;
  targetLanguageName?: string;
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

export default function EntryForm({ onDone, initialValues, existingEntries, sourceLanguageName, targetLanguageName }: EntryFormProps) {
  const { userId } = useAuth();
  const [sourceText, setSourceText] = useState(initialValues?.sourceText ?? '');
  const [targetText, setTargetText] = useState(initialValues?.targetText ?? '');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech | ''>(
    initialValues?.partOfSpeech ?? '',
  );
  const [tags, setTags] = useState<string[]>(initialValues?.tags ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const tagSuggestions = useLiveQuery(
    () => (userId ? getTagSuggestions(userId) : Promise.resolve([])),
    [userId],
    [],
  );

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!sourceText.trim()) errs['sourceText'] = sourceLanguageName
      ? `${sourceLanguageName} word or phrase is required`
      : 'Word or phrase is required';
    if (!targetText.trim()) errs['targetText'] = targetLanguageName
      ? `${targetLanguageName} translation is required`
      : 'Translation is required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function checkDuplicates(): string[] {
    if (!existingEntries) return [];
    const selfId = initialValues?.id;
    const normSrc = normalizeEntryText(sanitise(sourceText));
    const normTgt = normalizeEntryText(sanitise(targetText));
    const msgs: string[] = [];

    const dupSrc = existingEntries.find(
      (e) => e.id !== selfId && normalizeEntryText(e.sourceText) === normSrc,
    );
    if (dupSrc) {
      msgs.push(`An entry with this ${sourceLanguageName ? sourceLanguageName.toLowerCase() + ' ' : ''}word or phrase already exists ("${dupSrc.sourceText}"). Consider editing it to add synonyms instead.`);
    }

    const dupTgt = existingEntries.find(
      (e) => e.id !== selfId && !!e.targetText && normalizeEntryText(e.targetText) === normTgt,
    );
    if (dupTgt) {
      msgs.push(`An entry with this translation already exists ("${dupTgt.sourceText}"). Consider editing it to add synonyms instead.`);
    }

    return msgs;
  }


  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (!pendingSubmit) {
      const dupes = checkDuplicates();
      if (dupes.length > 0) {
        setWarnings(dupes);
        setPendingSubmit(true);
        return;
      }
    }

    setWarnings([]);
    setPendingSubmit(false);
    onDone({
      sourceText: normalizeEntryText(sanitise(sourceText)),
      targetText: normalizeEntryText(sanitise(targetText)),
      notes: sanitise(notes),
      partOfSpeech,
      tags,
    });
  }

  function handleCancel() {
    setWarnings([]);
    setPendingSubmit(false);
    onDone();
  }

  const isEditing = !!initialValues?.id;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h3 className={styles.heading}>{isEditing ? 'Edit entry' : 'Add entry'}</h3>

      {/* Word / phrase */}
      <div className={styles.field}>
        <label htmlFor="entry-source" className={styles.label}>
          {sourceLanguageName ? `Word / phrase in ${sourceLanguageName}` : 'Word / phrase'} <span className={styles.required}>*</span>
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

      {/* Translation */}
      <div className={styles.field}>
        <label htmlFor="entry-target" className={styles.label}>
          {targetLanguageName ? `${targetLanguageName} translation` : 'Translation'} <span className={styles.required}>*</span>
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

      {warnings.length > 0 && (
        <div className={styles.warningBox} role="alert">
          {warnings.map((w, i) => (
            <p key={i} className={styles.warningMsg}>⚠️ {w}</p>
          ))}
          <p className={styles.warningPrompt}>Do you want to proceed anyway?</p>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={handleCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.submitBtn}>
          {pendingSubmit ? 'Proceed anyway' : isEditing ? 'Save changes' : 'Add entry'}
        </button>
      </div>
    </form>
  );
}
