import DOMPurify from 'dompurify';
import styles from './TagInput.module.css';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
}

function sanitiseTag(raw: string): string {
  return DOMPurify.sanitize(raw.toLowerCase().replace(/\s+/g, '-')).trim().slice(0, 50);
}

export default function TagInput({
  tags,
  onChange,
  suggestions = [],
  maxTags = 20,
}: TagInputProps) {
  function addTag(raw: string) {
    const tag = sanitiseTag(raw);
    if (tag && !tags.includes(tag) && tags.length < maxTags) {
      onChange([...tags, tag]);
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && input.value === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (e.currentTarget.value.trim()) {
      addTag(e.currentTarget.value);
      e.currentTarget.value = '';
    }
  }

  const filteredSuggestions = suggestions.filter((s) => !tags.includes(s));

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
            <button
              type="button"
              className={styles.remove}
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        {tags.length < maxTags && (
          <input
            type="text"
            className={styles.input}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={tags.length === 0 ? 'Add tags (Enter or comma)…' : ''}
            aria-label="Add tag"
          />
        )}
      </div>

      {filteredSuggestions.length > 0 && (
        <div className={styles.suggestions}>
          {filteredSuggestions.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              className={styles.suggestion}
              onClick={() => addTag(s)}
            >
              #{s}
            </button>
          ))}
        </div>
      )}

      <p className={styles.hint}>Press Enter or comma to add. Max {maxTags} tags, 50 chars each.</p>
    </div>
  );
}
