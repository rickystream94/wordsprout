import { describe, expect, it, vi } from 'vitest';

vi.mock('dompurify', () => ({
  default: { sanitize: (value: string) => value.replace(/[<>]/g, '') },
}));

import { MAX_TAG_LENGTH, normalizeTag } from '../tags';

describe('normalizeTag', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeTag('  Travel Phrases  ')).toBe('travel-phrases');
  });

  it('sanitizes markup characters', () => {
    expect(normalizeTag('<Food>')).toBe('food');
  });

  it('limits the normalized value to 50 characters', () => {
    expect(normalizeTag('a'.repeat(80))).toHaveLength(MAX_TAG_LENGTH);
  });
});