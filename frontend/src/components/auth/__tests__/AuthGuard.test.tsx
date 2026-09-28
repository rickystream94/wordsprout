import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authState, quotaGet, runStartupSync, runOfflineDecay } = vi.hoisted(() => ({
  authState: {
    isAuthenticated: true,
    sessionRestoring: false,
    userId: 'user-1' as string | null,
  },
  quotaGet: vi.fn(async (): Promise<void> => undefined),
  runStartupSync: vi.fn(async (): Promise<void> => undefined),
  runOfflineDecay: vi.fn(async (): Promise<void> => undefined),
}));

vi.mock('../../../auth/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../../../services/api', () => ({
  ApiRequestError: class ApiRequestError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  quotaApi: { get: quotaGet },
}));
vi.mock('../../../services/startupSync', () => ({ runStartupSync, runOfflineDecay }));

import AuthGuard from '../AuthGuard';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setOnline(onLine: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: onLine });
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AuthGuard />}>
          <Route index element={<div>Protected app</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/access-blocked" element={<div>Access blocked</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthGuard startup gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    authState.sessionRestoring = false;
    authState.userId = 'user-1';
    quotaGet.mockResolvedValue(undefined);
    runStartupSync.mockResolvedValue(undefined);
    runOfflineDecay.mockResolvedValue(undefined);
  });

  it('enters immediately offline and starts local decay without a quota request', async () => {
    setOnline(false);

    renderGuard();

    expect(screen.getByText('Protected app')).toBeInTheDocument();
    await waitFor(() => expect(runOfflineDecay).toHaveBeenCalledWith('user-1'));
    expect(quotaGet).not.toHaveBeenCalled();
    expect(runStartupSync).not.toHaveBeenCalled();
  });

  it('shows progress and withholds the app until online reconciliation finishes', async () => {
    setOnline(true);
    const quota = deferred<void>();
    const sync = deferred<void>();
    quotaGet.mockReturnValue(quota.promise);
    runStartupSync.mockReturnValue(sync.promise);

    renderGuard();
    expect(screen.queryByText('Protected app')).not.toBeInTheDocument();

    await act(async () => quota.resolve());
    expect(await screen.findByText('Syncing your vocabulary. Hang tight…')).toBeInTheDocument();
    expect(screen.queryByText('Protected app')).not.toBeInTheDocument();

    await act(async () => sync.resolve());
    expect(await screen.findByText('Protected app')).toBeInTheDocument();
  });

  it('offers offline continuation after a recoverable startup failure', async () => {
    setOnline(true);
    quotaGet.mockRejectedValue(new Error('Network error'));
    const localDecay = deferred<void>();
    runOfflineDecay.mockReturnValue(localDecay.promise);

    renderGuard();

    const continueButton = await screen.findByRole('button', { name: 'Continue offline' });
    await userEvent.click(continueButton);
    expect(screen.queryByText('Protected app')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparing offline…' })).toBeDisabled();

    await act(async () => localDecay.resolve());
    expect(await screen.findByText('Protected app')).toBeInTheDocument();
  });
});