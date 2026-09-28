import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSession,
  hasRecoverableSession,
  storeSession,
} from '../sessionTokens';

function tokenWithClaims(claims: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

describe('hasRecoverableSession', () => {
  beforeEach(() => {
    clearSession();
  });

  it('accepts an expired access token with identity claims and a refresh token', () => {
    storeSession(tokenWithClaims({
      sub: 'user-1',
      email: 'user@example.com',
      provider: 'google',
      iss: 'wordsprout',
      exp: 1,
    }), 'refresh-token');

    expect(hasRecoverableSession()).toBe(true);
  });

  it('rejects a refresh token without decodable stored identity', () => {
    localStorage.setItem('wordsprout:refresh_token', 'refresh-token');

    expect(hasRecoverableSession()).toBe(false);
  });
});