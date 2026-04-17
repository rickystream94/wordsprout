import type { PartOfSpeech } from '../../types/models';
import styles from './PartOfSpeechSelector.module.css';

interface PartOfSpeechSelectorProps {
  value: PartOfSpeech | '';
  onChange: (value: PartOfSpeech | '') => void;
}

const OPTIONS: { value: PartOfSpeech | ''; label: string }[] = [
  { value: '',              label: 'Not set' },
  { value: 'noun',          label: 'Noun' },
  { value: 'verb',          label: 'Verb' },
  { value: 'adjective',     label: 'Adjective' },
  { value: 'adverb',        label: 'Adverb' },
  { value: 'pronoun',       label: 'Pronoun' },
  { value: 'preposition',   label: 'Preposition' },
  { value: 'conjunction',   label: 'Conjunction' },
  { value: 'article',       label: 'Article' },
  { value: 'interjection',  label: 'Interjection' },
  { value: 'numeral',       label: 'Numeral' },
  { value: 'idiom',         label: 'Idiom' },
  { value: 'phrasal_verb',  label: 'Phrasal Verb' },
  { value: 'expression',    label: 'Expression' },
  { value: 'other',         label: 'Other' },
];

export default function PartOfSpeechSelector({ value, onChange }: PartOfSpeechSelectorProps) {
  return (
    <div className={styles.wrapper} role="group" aria-label="Part of speech">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${styles.option} ${value === o.value ? styles.selected : ''}`}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
