import { beforeEach, describe, expect, it, vi } from 'vitest';

const { replayQueue, pullFromServer, applyDecayRound } = vi.hoisted(() => ({
  replayQueue: vi.fn(async (): Promise<void> => undefined),
  pullFromServer: vi.fn(async (): Promise<void> => undefined),
  applyDecayRound: vi.fn(async (): Promise<void> => undefined),
}));

vi.mock('../sync', () => ({ replayQueue, pullFromServer }));
vi.mock('../decay', () => ({ applyDecayRound }));
vi.mock('../../config/env', () => ({ API_BASE: '/api' }));

import { runOfflineDecay, runStartupSync } from '../startupSync';

describe('runStartupSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconciles pending work, server state, decay, and decay mutations in order', async () => {
    const order: string[] = [];
    replayQueue.mockImplementation(async () => { order.push('replay'); });
    pullFromServer.mockImplementation(async () => { order.push('pull'); });
    applyDecayRound.mockImplementation(async () => { order.push('decay'); });

    await runStartupSync('user-1');

    expect(order).toEqual(['replay', 'pull', 'decay', 'replay']);
    expect(pullFromServer).toHaveBeenCalledWith({ force: true });
    expect(applyDecayRound).toHaveBeenCalledWith('user-1', '/api');
  });

  it('reports each stage before beginning its operation', async () => {
    const stages: string[] = [];

    await runStartupSync('user-1', { onStageChange: stage => stages.push(stage) });

    expect(stages).toEqual(['uploading', 'downloading', 'decaying', 'finalizing']);
  });

  it('shares one reconciliation across concurrent startup callers', async () => {
    let releaseFirstReplay: (() => void) | undefined;
    replayQueue.mockImplementationOnce(() => new Promise<void>(resolve => {
      releaseFirstReplay = resolve;
    }));

    const first = runStartupSync('user-1');
    const second = runStartupSync('user-1');
    releaseFirstReplay?.();
    await Promise.all([first, second]);

    expect(pullFromServer).toHaveBeenCalledOnce();
    expect(applyDecayRound).toHaveBeenCalledOnce();
    expect(replayQueue).toHaveBeenCalledTimes(2);
  });
});

describe('runOfflineDecay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies local decay without invoking network synchronization', async () => {
    await runOfflineDecay('user-1');

    expect(applyDecayRound).toHaveBeenCalledWith('user-1', '/api');
    expect(replayQueue).not.toHaveBeenCalled();
    expect(pullFromServer).not.toHaveBeenCalled();
  });
});