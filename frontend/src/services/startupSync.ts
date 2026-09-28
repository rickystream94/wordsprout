import { API_BASE } from '../config/env';
import { applyDecayRound } from './decay';
import { pullFromServer, replayQueue } from './sync';

export type StartupSyncStage = 'uploading' | 'downloading' | 'decaying' | 'finalizing';

interface StartupSyncOptions {
  onStageChange?: (stage: StartupSyncStage) => void;
}

let startupInFlight: Promise<void> | null = null;
let currentStage: StartupSyncStage | null = null;
const stageListeners = new Set<(stage: StartupSyncStage) => void>();

function reportStage(stage: StartupSyncStage): void {
  currentStage = stage;
  for (const listener of stageListeners) listener(stage);
}

async function reconcile(userId: string): Promise<void> {
  reportStage('uploading');
  await replayQueue();

  reportStage('downloading');
  await pullFromServer({ force: true });

  reportStage('decaying');
  await applyDecayRound(userId, API_BASE);

  reportStage('finalizing');
  await replayQueue();
}

export async function runStartupSync(
  userId: string,
  options: StartupSyncOptions = {},
): Promise<void> {
  const listener = options.onStageChange;
  if (listener) {
    stageListeners.add(listener);
    if (currentStage) listener(currentStage);
  }

  if (!startupInFlight) {
    startupInFlight = reconcile(userId).finally(() => {
      startupInFlight = null;
      currentStage = null;
    });
  }

  try {
    await startupInFlight;
  } finally {
    if (listener) stageListeners.delete(listener);
  }
}

export function runOfflineDecay(userId: string): Promise<void> {
  return applyDecayRound(userId, API_BASE);
}