import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  publicClientApplication: vi.fn(() => ({
    initialize: vi.fn(),
    handleRedirectPromise: vi.fn(),
  })),
}));

vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: mocks.publicClientApplication,
}));

describe('MSAL configuration', () => {
  beforeEach(() => {
    mocks.publicClientApplication.mockClear();
  });

  it('uses the common authority so organizational and personal accounts can sign in', async () => {
    vi.resetModules();

    const { MICROSOFT_AUTHORITY } = await import('../msalConfig');

    expect(MICROSOFT_AUTHORITY).toBe('https://login.microsoftonline.com/common');
    expect(mocks.publicClientApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          authority: 'https://login.microsoftonline.com/common',
        }),
      }),
    );
  });
});
