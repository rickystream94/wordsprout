import { useContext } from 'react';
import {
  InstallPromptContext,
  type InstallPromptContextValue,
} from './installPromptCtx';

export type { InstallPromptContextValue };

export function useInstallPrompt(): InstallPromptContextValue {
  return useContext(InstallPromptContext);
}

