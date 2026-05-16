import { describe, it, expect } from 'vitest';
import { randomUUID } from '../uuid';

describe('randomUUID', () => {
  it('returns a string matching UUID v4 format', () => {
    const id = randomUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generates a unique value on each call', () => {
    const a = randomUUID();
    const b = randomUUID();
    expect(a).not.toBe(b);
  });

  it('generates a new UUID that is a non-empty string', () => {
    const id = randomUUID();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});
