import { useRef, useState } from 'react';
import { MAX_TAGS_PER_ENTRY } from '../../utils/tags';
import TagPickerDialog from './TagPickerDialog';
import styles from './TagInput.module.css';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
}

export default function TagInput({
  tags,
  onChange,
  suggestions = [],
  maxTags = MAX_TAGS_PER_ENTRY,
}: TagInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function closePicker() {
    setPickerOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

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
        {tags.length === 0 && <span className={styles.empty}>No tags selected</span>}
      </div>

      <button ref={triggerRef} type="button" className={styles.pickerButton} onClick={() => setPickerOpen(true)}>
        Choose tags
      </button>
      <p className={styles.hint}>{tags.length} of {maxTags} tags selected.</p>

      {pickerOpen && (
        <TagPickerDialog
          availableTags={suggestions}
          selectedTags={tags}
          maxTags={maxTags}
          onApply={nextTags => {
            onChange(nextTags);
            closePicker();
          }}
          onCancel={closePicker}
        />
      )}
    </div>
  );
}
