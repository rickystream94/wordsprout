import DOMPurify from 'dompurify';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import type { DBEntry, DBEnrichment } from '../../services/db';
import { getTagSuggestions } from '../../services/db';
import type { PartOfSpeech } from '../../types/models';
import PartOfSpeechSelector from './PartOfSpeechSelector';
import TagInput from './TagInput';
import ChipInput from './ChipInput';
import { SortDropdown, type SortOption } from '../search/SortDropdown';
import Tooltip from '../common/Tooltip';
import styles from './EntryForm.module.css';

export interface EntryFormData {
  sourceText: string;
  targetText: string;
  notes: string;
  partOfSpeech: PartOfSpeech | '';
  tags: string[];
  enrichment?: {
    exampleSentences: string[];
    synonyms: string[];
    antonyms: string[];
    collocations: string[];
    register: string;
    falseFriendWarning: string;
  };
}

interface EntryFormProps {
  onDone: (data?: EntryFormData) => void;
  initialValues?: Partial<DBEntry>;
  /** Existing enrichment to pre-fill */
  initialEnrichment?: DBEnrichment;
  /** Existing entries in the same phrasebook — used for duplicate detection */
  existingEntries?: DBEntry[];
  /** Language names shown in field labels (e.g. "Italian", "English") */
  sourceLanguageName?: string;
  targetLanguageName?: string;
}

const REGISTER_OPTIONS: SortOption<string>[] = [
  { value: '', label: '— not set —' },
  { value: 'formal', label: 'Formal' },
  { value: 'informal', label: 'Informal' },
  { value: 'colloquial', label: 'Colloquial' },
  { value: 'neutral', label: 'Neutral' },
];

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

export default function EntryForm({ onDone, initialValues, initialEnrichment, existingEntries, sourceLanguageName, targetLanguageName }: EntryFormProps) {
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

  // Enrichment editing state (only when editing an existing entry)
  const [exampleSentences, setExampleSentences] = useState<string[]>(initialEnrichment?.exampleSentences ?? []);
  const [synonyms, setSynonyms] = useState<string[]>(initialEnrichment?.synonyms ?? []);
  const [antonyms, setAntonyms] = useState<string[]>(initialEnrichment?.antonyms ?? []);
  const [collocations, setCollocations] = useState<string[]>(initialEnrichment?.collocations ?? []);
  const [register, setRegister] = useState(initialEnrichment?.register ?? '');
  const [falseFriendWarning, setFalseFriendWarning] = useState(initialEnrichment?.falseFriendWarning ?? '');

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

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function checkDuplicates(): string[] {
    if (!existingEntries) return [];
    const selfId = initialValues?.id;
    const normSrc = normalizeEntryText(sanitise(sourceText));
    const normTgt = targetText.trim() ? normalizeEntryText(sanitise(targetText)) : '';
    const msgs: string[] = [];

    const dupSrc = existingEntries.find(
      (e) => e.id !== selfId && normalizeEntryText(e.sourceText) === normSrc,
    );
    if (dupSrc) {
      msgs.push(`An entry with this ${sourceLanguageName ? sourceLanguageName.toLowerCase() + ' ' : ''}word or phrase already exists ("${dupSrc.sourceText}"). Consider editing it to add synonyms instead.`);
    }

    const dupTgt = normTgt ? existingEntries.find(
      (e) => e.id !== selfId && !!e.targetText && normalizeEntryText(e.targetText) === normTgt,
    ) : undefined;
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
      enrichment: {
        exampleSentences,
        synonyms,
        antonyms,
        collocations,
        register,
        falseFriendWarning: falseFriendWarning.trim(),
      },
    });
  }

  function handleCancel() {
    setWarnings([]);
    setPendingSubmit(false);
    onDone();
  }

  const isEditing = !!initialValues?.id;

  const enrichmentFields = (
    <>
      <div className={styles.field}>
        <Tooltip text="The grammatical category of this word (noun, verb, adjective, etc.)">
          <span className={styles.label}>Part of speech</span>
        </Tooltip>
        <PartOfSpeechSelector value={partOfSpeech} onChange={setPartOfSpeech} />
      </div>

      <div className={styles.field}>
        <Tooltip text="Sentences demonstrating natural usage of this word">
          <span className={styles.label}>Example sentences</span>
        </Tooltip>
        <ChipInput
          values={exampleSentences}
          onChange={setExampleSentences}
          placeholder="Add example sentence…"
          multiline
        />
      </div>

      <div className={styles.field}>
        <Tooltip text="Words or phrases with similar meaning in the target language">
          <span className={styles.label}>Synonyms</span>
        </Tooltip>
        <ChipInput values={synonyms} onChange={setSynonyms} placeholder="Add synonym…" />
      </div>

      <div className={styles.field}>
        <Tooltip text="Words or phrases with opposite meaning in the target language">
          <span className={styles.label}>Antonyms</span>
        </Tooltip>
        <ChipInput values={antonyms} onChange={setAntonyms} placeholder="Add antonym…" />
      </div>

      <div className={styles.field}>
        <Tooltip text="Common word combinations that naturally go with this term in the target language">
          <span className={styles.label}>Collocations</span>
        </Tooltip>
        <ChipInput values={collocations} onChange={setCollocations} placeholder="Add collocation…" />
      </div>

      <div className={styles.field}>
        <Tooltip text="The formality level of this word (formal, informal, colloquial, neutral)">
          <span className={styles.label}>Register</span>
        </Tooltip>
        <SortDropdown
          value={register}
          options={REGISTER_OPTIONS}
          onChange={setRegister}
          label=""
        />
      </div>

      <div className={styles.field}>
        <Tooltip text="A warning about similar-looking words in other languages that have different meanings">
          <span className={styles.label}>False-friend warning</span>
        </Tooltip>
        <input
          className={styles.enrichInput}
          value={falseFriendWarning}
          onChange={(e) => setFalseFriendWarning(e.target.value)}
          placeholder="e.g. 'sensible' in Spanish means 'sensitive'"
        />
      </div>
    </>
  );

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
          {targetLanguageName ? `${targetLanguageName} translation` : 'Translation'} <span className={styles.optional}>(optional — AI can translate)</span>
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

      {/* Tags */}
      <div className={styles.field}>
        <label className={styles.label}>Tags</label>
        <TagInput tags={tags} onChange={setTags} suggestions={tagSuggestions ?? []} />
      </div>

      {/* ── Enrichment fields ─────────────────────────────────────────── */}
      {isEditing ? (
        <>
          <hr className={styles.divider} />
          <h4 className={styles.sectionHeading}>Enrichment</h4>
          {enrichmentFields}
        </>
      ) : (
        <details className={styles.advanced}>
          <summary className={styles.advancedToggle}>Advanced fields <span className={styles.optional}>(optional — auto-filled by AI enrichment)</span></summary>
          <div className={styles.advancedContent}>
            {enrichmentFields}
          </div>
        </details>
      )}

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
