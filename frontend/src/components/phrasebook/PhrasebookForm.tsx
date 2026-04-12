import { useEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '../../types/models';
import styles from './PhrasebookForm.module.css';

interface PhrasebookFormProps {
  /** Called with the finished phrasebook data, or undefined on cancel */
  onDone: (data?: PhrasebookFormData) => void;
  /** Pre-fill values when editing an existing phrasebook */
  initialValues?: PhrasebookFormData;
}

export interface PhrasebookFormData {
  name: string;
  sourceLanguageCode: string;
  sourceLanguageName: string;
  targetLanguageCode: string;
  targetLanguageName: string;
}

// ─── Language selector sub-component ─────────────────────────────────────────

interface LanguageSelectorProps {
  label: string;
  value: string;
  languages: Language[];
  onChange: (code: string, name: string) => void;
  id: string;
}

function LanguageSelector({ label, value, languages, onChange, id }: LanguageSelectorProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedName = languages.find((l) => l.code === value)?.name ?? '';

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q
      ? languages.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().startsWith(q))
      : languages;
  }, [query, languages]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(code: string, name: string) {
    onChange(code, name);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className={styles.field} ref={containerRef}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <button
        id={id}
        type="button"
        className={styles.selectTrigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedName || <span className={styles.placeholder}>Select language…</span>}
        <span className={styles.chevron} aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.dropdown} role="listbox">
          <input
            className={styles.search}
            placeholder="Search language…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <ul className={styles.optionList}>
            {filtered.slice(0, 80).map((l) => (
              <li
                key={l.code}
                role="option"
                aria-selected={l.code === value}
                className={`${styles.option} ${l.code === value ? styles.optionSelected : ''}`}
                onMouseDown={() => handleSelect(l.code, l.name)}
              >
                <span className={styles.optionCode}>{l.code}</span>
                {l.name}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className={styles.noResults}>No languages found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── PhrasebookForm ───────────────────────────────────────────────────────────

export default function PhrasebookForm({ onDone, initialValues }: PhrasebookFormProps) {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [name, setName] = useState(initialValues?.name ?? '');
  const [sourceLangCode, setSourceLangCode] = useState(initialValues?.sourceLanguageCode ?? '');
  const [sourceLangName, setSourceLangName] = useState(initialValues?.sourceLanguageName ?? '');
  const [targetLangCode, setTargetLangCode] = useState(initialValues?.targetLanguageCode ?? '');
  const [targetLangName, setTargetLangName] = useState(initialValues?.targetLanguageName ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/languages.json')
      .then((r) => r.json())
      .then((data: Language[]) => setLanguages(data))
      .catch(console.error);
  }, []);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs['name'] = 'Name is required';
    if (!sourceLangCode) errs['source'] = 'Source language is required';
    if (!targetLangCode) errs['target'] = 'Target language is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    onDone({
      name: name.trim(),
      sourceLanguageCode: sourceLangCode,
      sourceLanguageName: sourceLangName,
      targetLanguageCode: targetLangCode,
      targetLanguageName: targetLangName,
    });
    setSubmitting(false);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.heading}>
        {initialValues ? 'Edit phrasebook' : 'New phrasebook'}
      </h2>

      <div className={styles.field}>
        <label htmlFor="pb-name" className={styles.label}>Name</label>
        <input
          id="pb-name"
          className={`${styles.input} ${errors['name'] ? styles.inputError : ''}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Italian Travel Phrases"
          maxLength={120}
          autoFocus
        />
        {errors['name'] && <p className={styles.errorMsg}>{errors['name']}</p>}
      </div>

      <LanguageSelector
        id="pb-source"
        label="Source language (you know)"
        value={sourceLangCode}
        languages={languages}
        onChange={(code, name) => { setSourceLangCode(code); setSourceLangName(name); }}
      />
      {errors['source'] && <p className={styles.errorMsg}>{errors['source']}</p>}

      <LanguageSelector
        id="pb-target"
        label="Target language (you're learning)"
        value={targetLangCode}
        languages={languages}
        onChange={(code, name) => { setTargetLangCode(code); setTargetLangName(name); }}
      />
      {errors['target'] && <p className={styles.errorMsg}>{errors['target']}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={() => onDone()}>
          Cancel
        </button>
        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Saving…' : initialValues ? 'Save changes' : 'Create phrasebook'}
        </button>
      </div>
    </form>
  );
}
