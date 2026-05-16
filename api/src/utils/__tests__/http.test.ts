import { describe, it, expect } from 'vitest';
import { apiError, resolveId } from '../http';

// ─── apiError ─────────────────────────────────────────────────────────────────

describe('apiError', () => {
  it('uses "Error" label for 401', () => {
    const res = apiError(401, 'unauthorized');
    expect(res.status).toBe(401);
    expect((res.jsonBody as Record<string, unknown>).error).toBe('Error');
    expect((res.jsonBody as Record<string, unknown>).message).toBe('unauthorized');
    expect((res.jsonBody as Record<string, unknown>).statusCode).toBe(401);
  });

  it('uses "Forbidden" label for 403', () => {
    const res = apiError(403, 'not allowed');
    expect(res.status).toBe(403);
    expect((res.jsonBody as Record<string, unknown>).error).toBe('Forbidden');
  });

  it('uses "Not Found" label for 404', () => {
    const res = apiError(404, 'missing resource');
    expect(res.status).toBe(404);
    expect((res.jsonBody as Record<string, unknown>).error).toBe('Not Found');
  });

  it('uses "Conflict" label for 409', () => {
    const res = apiError(409, 'duplicate entry');
    expect(res.status).toBe(409);
    expect((res.jsonBody as Record<string, unknown>).error).toBe('Conflict');
  });

  it('uses "Error" label for 500 and other codes', () => {
    const res = apiError(500, 'internal error');
    expect(res.status).toBe(500);
    expect((res.jsonBody as Record<string, unknown>).error).toBe('Error');
  });

  it('includes message and statusCode in body for all responses', () => {
    const res = apiError(422, 'validation failed');
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.message).toBe('validation failed');
    expect(body.statusCode).toBe(422);
  });
});

// ─── resolveId ────────────────────────────────────────────────────────────────

describe('resolveId', () => {
  it('returns a valid UUID v4 string unchanged', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(resolveId(id)).toBe(id);
  });

  it('generates a new UUID for a non-UUID string', () => {
    const result = resolveId('not-a-uuid');
    expect(result).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(result).not.toBe('not-a-uuid');
  });

  it('generates a new UUID for undefined', () => {
    const result = resolveId(undefined);
    expect(result).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('generates a new UUID for a number', () => {
    const result = resolveId(123);
    expect(result).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('generates a new UUID for null', () => {
    const result = resolveId(null);
    expect(result).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('generates different UUIDs on successive calls with invalid input', () => {
    const a = resolveId(undefined);
    const b = resolveId(undefined);
    expect(a).not.toBe(b);
  });
});
