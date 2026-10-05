import { beforeEach, describe, expect, it, vi } from 'vitest';

const { drainSyncQueue, pullFromServer, applyDecayRound } = vi.hoisted(() => ({
  drainSyncQueue: vi.fn(async (): Promise<void> => undefined),
  pullFromServer: vi.fn(async (): Promise<void> => undefined),
  applyDecayRound: vi.fn(async (): Promise<void> => undefined),
}));

vi.mock('../sync', () => ({ drainSyncQueue, pullFromServer }));
vi.mock('../decay', () => ({ applyDecayRound }));
vi.mock('../../config/env', () => ({ API_BASE: '/api' }));

import {
  hasInitialStartupSyncCompleted,
  runInitialStartupSync,
  runOfflineDecay,
  runStartupSync,
} from '../startupSync';

describe('runStartupSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconciles pending work, server state, decay, and decay mutations in order', async () => {
    const order: string[] = [];
    drainSyncQueue.mockImplementation(async () => {
      order.push('replay');
    });
    pullFromServer.mockImplementation(async () => {
      order.push('pull');
    });
    applyDecayRound.mockImplementation(async () => {
      order.push('decay');
    });

    await runStartupSync('user-1');

    expect(order).toEqual(['replay', 'pull', 'decay', 'replay']);
    expect(pullFromServer).toHaveBeenCalledWith({ force: true });
    expect(applyDecayRound).toHaveBeenCalledWith('user-1', '/api');
  });

  it('reports each stage before beginning its operation', async () => {
    const stages: string[] = [];

    await runStartupSync('user-1', { onStageChange: (stage) => stages.push(stage) });

    expect(stages).toEqual(['uploading', 'downloading', 'decaying', 'finalizing']);
  });

  it('reports determinate progress only after each blocking phase completes', async () => {
    const percentages: number[] = [];

    await runStartupSync('progress-user', {
      onProgressChange: (progress) => percentages.push(progress.percent),
    });

    expect(percentages).toEqual([0, 25, 50, 75, 100]);
  });

  it('shares one reconciliation across concurrent startup callers', async () => {
    let releaseFirstReplay: (() => void) | undefined;
    drainSyncQueue.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirstReplay = resolve;
        }),
    );

    const first = runStartupSync('user-1');
    const second = runStartupSync('user-1');
    releaseFirstReplay?.();
    await Promise.all([first, second]);

    expect(pullFromServer).toHaveBeenCalledOnce();
    expect(applyDecayRound).toHaveBeenCalledOnce();
    expect(drainSyncQueue).toHaveBeenCalledTimes(2);
  });

  it('does not complete startup when queue draining fails', async () => {
    drainSyncQueue.mockRejectedValueOnce(new Error('Synchronization left 2 pending mutations'));

    await expect(runStartupSync('pending-user')).rejects.toThrow(
      'Synchronization left 2 pending mutations',
    );
  });
});

describe('runOfflineDecay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies local decay without invoking network synchronization', async () => {
    await runOfflineDecay('user-1');

    expect(applyDecayRound).toHaveBeenCalledWith('user-1', '/api');
    expect(drainSyncQueue).not.toHaveBeenCalled();
    expect(pullFromServer).not.toHaveBeenCalled();
  });
});

describe('runInitialStartupSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs blocking reconciliation only once per user after it succeeds', async () => {
    expect(hasInitialStartupSyncCompleted('initial-user')).toBe(false);

    await runInitialStartupSync('initial-user');
    await runInitialStartupSync('initial-user');

    expect(hasInitialStartupSyncCompleted('initial-user')).toBe(true);
    expect(pullFromServer).toHaveBeenCalledOnce();
    expect(applyDecayRound).toHaveBeenCalledOnce();
    expect(drainSyncQueue).toHaveBeenCalledTimes(2);
  });

  it('does not mark a failed initial reconciliation as complete', async () => {
    pullFromServer.mockRejectedValueOnce(new Error('Network error'));

    await expect(runInitialStartupSync('retry-user')).rejects.toThrow('Network error');

    expect(hasInitialStartupSyncCompleted('retry-user')).toBe(false);
  });
});
