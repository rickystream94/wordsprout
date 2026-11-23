import DOMPurify from 'dompurify';

export const MAX_TAGS_PER_ENTRY = 20;
export const MAX_TAG_LENGTH = 50;

export function normalizeTag(raw: string): string {
  return DOMPurify
    .sanitize(raw.toLowerCase().trim().replace(/\s+/g, '-'))
    .trim()
    .slice(0, MAX_TAG_LENGTH);
}