import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockStartupSyncOptions {
  onProgressChange?: (progress: {
    stage: 'uploading' | 'downloading' | 'decaying' | 'finalizing';
    completedSteps: number;
    totalSteps: number;
    percent: number;
  }) => void;
}

const {
  authState,
  syncState,
  quotaGet,
  runInitialStartupSync,
  runOfflineDecay,
  markInitialStartupSyncCompleted,
} = vi.hoisted(() => ({
  authState: {
    isAuthenticated: true,
    sessionRestoring: false,
    userId: 'user-1' as string | null,
  },
  syncState: { completed: false },
  quotaGet: vi.fn(async (): Promise<void> => undefined),
  runInitialStartupSync: vi.fn(
    async (userId: string, options?: MockStartupSyncOptions): Promise<void> => {
      void userId;
      void options;
    },
  ),
  runOfflineDecay: vi.fn(async (): Promise<void> => undefined),
  markInitialStartupSyncCompleted: vi.fn(),
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
vi.mock('../../../services/startupSync', () => ({
  hasInitialStartupSyncCompleted: () => syncState.completed,
  markInitialStartupSyncCompleted,
  runInitialStartupSync,
  runOfflineDecay,
}));

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
    syncState.completed = false;
    quotaGet.mockResolvedValue(undefined);
    runInitialStartupSync.mockImplementation(async () => {
      syncState.completed = true;
    });
    runOfflineDecay.mockResolvedValue(undefined);
    markInitialStartupSyncCompleted.mockImplementation(() => {
      syncState.completed = true;
    });
  });

  it('enters immediately offline and starts local decay without a quota request', async () => {
    setOnline(false);

    renderGuard();

    expect(screen.getByText('Protected app')).toBeInTheDocument();
    await waitFor(() => expect(runOfflineDecay).toHaveBeenCalledWith('user-1'));
    expect(quotaGet).not.toHaveBeenCalled();
    expect(runInitialStartupSync).not.toHaveBeenCalled();
    expect(markInitialStartupSyncCompleted).toHaveBeenCalledWith('user-1');
  });

  it('shows progress and withholds the app until online reconciliation finishes', async () => {
    setOnline(true);
    const quota = deferred<void>();
    const sync = deferred<void>();
    quotaGet.mockReturnValue(quota.promise);
    runInitialStartupSync.mockImplementation(async (_userId, options) => {
      options?.onProgressChange?.({
        stage: 'decaying',
        completedSteps: 2,
        totalSteps: 4,
        percent: 50,
      });
      await sync.promise;
      syncState.completed = true;
    });

    renderGuard();
    expect(screen.queryByText('Protected app')).not.toBeInTheDocument();

    await act(async () => quota.resolve());
    expect(await screen.findByText('Syncing your vocabulary. Hang tight…')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('Updating learning scores · 50%')).toBeInTheDocument();
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
    expect(markInitialStartupSyncCompleted).toHaveBeenCalledWith('user-1');
  });

  it('does not rerun startup checks when the guard remounts after success', async () => {
    setOnline(true);
    const firstRender = renderGuard();
    expect(await screen.findByText('Protected app')).toBeInTheDocument();
    expect(quotaGet).toHaveBeenCalledOnce();
    expect(runInitialStartupSync).toHaveBeenCalledOnce();

    firstRender.unmount();
    renderGuard();

    expect(screen.getByText('Protected app')).toBeInTheDocument();
    expect(quotaGet).toHaveBeenCalledOnce();
    expect(runInitialStartupSync).toHaveBeenCalledOnce();
  });
});
