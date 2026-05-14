import type { PartOfSpeech } from '../../types/models';
import { SortDropdown } from '../search/SortDropdown';

interface PartOfSpeechSelectorProps {
  value: PartOfSpeech | '';
  onChange: (value: PartOfSpeech | '') => void;
}

const OPTIONS: { value: string; label: string }[] = [
  { value: '',              label: '— not set —' },
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
    <SortDropdown
      value={value}
      options={OPTIONS}
      onChange={(v) => onChange(v as PartOfSpeech | '')}
      label=""
    />
  );
}
