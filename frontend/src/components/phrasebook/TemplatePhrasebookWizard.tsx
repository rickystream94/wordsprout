import { useState } from 'react';
import {
  TEMPLATE_LANGUAGES,
  type TemplateLanguageCode,
} from '../../data/templatePhrasebooks';
import { generateTemplatePhrasebook, type DBPhrasebook } from '../../services/db';
import { DuplicateLanguagePairError } from '../../services/db';
import { API_BASE } from '../../config/env';
import styles from './TemplatePhrasebookWizard.module.css';

interface TemplatePhrasebookWizardProps {
  userId: string;
  existingTargetCodes: string[];
  onDone: (pb?: DBPhrasebook) => void;
}

export default function TemplatePhrasebookWizard({
  userId,
  existingTargetCodes,
  onDone,
}: TemplatePhrasebookWizardProps) {
  const [selected, setSelected] = useState<TemplateLanguageCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const pb = await generateTemplatePhrasebook(userId, selected, API_BASE);
      onDone(pb);
    } catch (err) {
      if (err instanceof DuplicateLanguagePairError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wizard}>
      <h2 className={styles.heading}>Start from a template</h2>
      <p className={styles.description}>
        Get a head start with 50 vocabulary words, complete with tags. Everything is fully editable
        once generated — rename the phrasebook, add or remove entries, update tags, and enrich any
        entry at any time. You can also delete it and start from scratch if you prefer.
      </p>

      <div className={styles.languageRow}>
        <div className={styles.languageBox}>
          <span className={styles.languageLabel}>You speak</span>
          <span className={styles.languageFixed}>English</span>
        </div>

        <span className={styles.arrow} aria-hidden="true">→</span>

        <div className={styles.languageBox}>
          <span className={styles.languageLabel}>You're learning</span>
          <div className={styles.optionGrid} role="listbox" aria-label="Select target language">
            {TEMPLATE_LANGUAGES.map((lang) => {
              const disabled = existingTargetCodes.includes(lang.code);
              const isSelected = selected === lang.code;
              return (
                <button
                  key={lang.code}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={disabled}
                  disabled={disabled}
                  title={disabled ? `You already have an English → ${lang.name} phrasebook` : undefined}
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ''} ${disabled ? styles.optionDisabled : ''}`}
                  onClick={() => { if (!disabled) { setSelected(lang.code); setError(null); } }}
                >
                  {lang.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <p className={styles.errorMsg} role="alert">{error}</p>}

      <div className={styles.actions}>
        <button
          className={styles.generateBtn}
          disabled={!selected || loading}
          onClick={handleGenerate}
        >
          {loading ? <span className={styles.spinner} aria-label="Generating…" /> : 'Generate phrasebook'}
        </button>
        <button className={styles.cancelBtn} onClick={() => onDone(undefined)} disabled={loading}>
          Cancel
        </button>
      </div>
    </div>
  );
}
