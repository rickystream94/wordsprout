import { useEffect, useRef, useState } from 'react';
import styles from './FilterPanel.module.css';

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

interface SortDropdownProps<T extends string> {
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
  label?: string;
}

export function SortDropdown<T extends string>({ value, options, onChange, label = 'Sort by' }: SortDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={styles.dropdown} ref={ref}>
      <button
        type="button"
        className={styles.dropdownTrigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.dropdownLabel}><span style={{ color: 'var(--text-muted)', marginRight: 'var(--space-1)' }}>{label}:</span>{selected?.label}</span>
        <svg
          className={`${styles.dropdownChevron} ${open ? styles.dropdownChevronOpen : ''}`}
          width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
        >
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className={styles.dropdownMenu} role="listbox" aria-label={label}>
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${styles.dropdownItem} ${opt.value === value ? styles.dropdownItemChecked : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onChange(opt.value); setOpen(false); } }}
              tabIndex={0}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
