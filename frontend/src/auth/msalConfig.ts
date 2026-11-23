import { PublicClientApplication, type Configuration } from '@azure/msal-browser';
import { AUTH_CONFIG } from '../config/env';

export const MICROSOFT_AUTHORITY = 'https://login.microsoftonline.com/common';

const msalConfig: Configuration = {
  auth: {
    clientId: AUTH_CONFIG.clientId || 'local-client-id',
    authority: MICROSOFT_AUTHORITY,
    redirectUri: AUTH_CONFIG.redirectUri,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Initialise MSAL before the app renders — called from main.tsx
export async function initializeMsal() {
  await msalInstance.initialize();
  // Handle redirect response on page load
  await msalInstance.handleRedirectPromise();
}
