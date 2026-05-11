import { useState, useRef } from 'react';
import styles from './ChipInput.module.css';

interface ChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** If true, chips render as full sentences (no inline-flex pill) */
  multiline?: boolean;
}

export default function ChipInput({ values, onChange, placeholder, multiline }: ChipInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addItem() {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft('');
  }

  function removeItem(item: string) {
    onChange(values.filter((v) => v !== item));
  }

  return (
    <div className={styles.wrapper}>
      <div className={multiline ? styles.list : styles.chips}>
        {values.map((v) => (
          <span key={v} className={multiline ? styles.sentence : styles.chip}>
            {v}
            <button
              type="button"
              className={styles.remove}
              onClick={() => removeItem(v)}
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        className={styles.input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
          }
        }}
        onBlur={addItem}
        placeholder={placeholder}
      />
    </div>
  );
}
