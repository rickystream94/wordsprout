import { API_BASE } from '../config/env';
import { applyDecayRound } from './decay';
import { drainSyncQueue, pullFromServer } from './sync';

export type StartupSyncStage = 'uploading' | 'downloading' | 'decaying' | 'finalizing';

export interface StartupSyncProgress {
  stage: StartupSyncStage;
  completedSteps: number;
  totalSteps: number;
  percent: number;
}

interface StartupSyncOptions {
  onStageChange?: (stage: StartupSyncStage) => void;
  onProgressChange?: (progress: StartupSyncProgress) => void;
}

const TOTAL_STEPS = 4;
let startupInFlight: Promise<void> | null = null;
let currentStage: StartupSyncStage | null = null;
let currentProgress: StartupSyncProgress | null = null;
const stageListeners = new Set<(stage: StartupSyncStage) => void>();
const progressListeners = new Set<(progress: StartupSyncProgress) => void>();
const initiallySyncedUsers = new Set<string>();

function reportProgress(stage: StartupSyncStage, completedSteps: number): void {
  const stageChanged = currentStage !== stage;
  currentStage = stage;
  currentProgress = {
    stage,
    completedSteps,
    totalSteps: TOTAL_STEPS,
    percent: Math.round((completedSteps / TOTAL_STEPS) * 100),
  };
  if (stageChanged) {
    for (const listener of stageListeners) listener(stage);
  }
  for (const listener of progressListeners) listener(currentProgress);
}

async function reconcile(userId: string): Promise<void> {
  reportProgress('uploading', 0);
  await drainSyncQueue();

  reportProgress('downloading', 1);
  await pullFromServer({ force: true });

  reportProgress('decaying', 2);
  await applyDecayRound(userId, API_BASE);

  reportProgress('finalizing', 3);
  await drainSyncQueue();
  reportProgress('finalizing', 4);
}

export async function runStartupSync(
  userId: string,
  options: StartupSyncOptions = {},
): Promise<void> {
  const listener = options.onStageChange;
  const progressListener = options.onProgressChange;
  if (listener) {
    stageListeners.add(listener);
    if (currentStage) listener(currentStage);
  }
  if (progressListener) {
    progressListeners.add(progressListener);
    if (currentProgress) progressListener(currentProgress);
  }

  if (!startupInFlight) {
    startupInFlight = reconcile(userId).finally(() => {
      startupInFlight = null;
      currentStage = null;
      currentProgress = null;
    });
  }

  try {
    await startupInFlight;
  } finally {
    if (listener) stageListeners.delete(listener);
    if (progressListener) progressListeners.delete(progressListener);
  }
}

export function hasInitialStartupSyncCompleted(userId: string): boolean {
  return initiallySyncedUsers.has(userId);
}

export function markInitialStartupSyncCompleted(userId: string): void {
  initiallySyncedUsers.add(userId);
}

export async function runInitialStartupSync(
  userId: string,
  options: StartupSyncOptions = {},
): Promise<void> {
  if (hasInitialStartupSyncCompleted(userId)) return;
  await runStartupSync(userId, options);
  markInitialStartupSyncCompleted(userId);
}

export function runOfflineDecay(userId: string): Promise<void> {
  return applyDecayRound(userId, API_BASE);
}
