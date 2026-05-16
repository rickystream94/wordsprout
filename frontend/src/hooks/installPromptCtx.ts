import { createContext } from 'react';

export interface InstallPromptContextValue {
  /** True when the browser has provided a deferrable install prompt (Android/Chrome/Edge). */
  canPromptAndroid: boolean;
  /** True when running in iOS Safari (no programmatic prompt; requires manual steps). */
  isIOS: boolean;
  /** True when the PWA is already installed / running in standalone mode. */
  isInstalled: boolean;
  /** True on a mobile form factor. */
  isMobile: boolean;
  /** True once the user has performed a meaningful action (set via markEngaged). */
  hasEngaged: boolean;
  /** True when the install banner should be shown (all conditions combined). */
  showBanner: boolean;
  /** Call once the user has done something meaningful (e.g. opened a phrasebook or entry). */
  markEngaged(): void;
  /** Trigger the native install dialog (Android only; no-op on iOS). */
  prompt(): Promise<void>;
  /** Hide the install banner and suppress it for 30 days. */
  dismiss(): void;
}

export const InstallPromptContext = createContext<InstallPromptContextValue>({
  canPromptAndroid: false,
  isIOS: false,
  isInstalled: false,
  isMobile: false,
  hasEngaged: false,
  showBanner: false,
  markEngaged: () => {},
  prompt: async () => {},
  dismiss: () => {},
});
