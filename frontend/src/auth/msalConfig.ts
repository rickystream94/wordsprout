import { PublicClientApplication, type Configuration } from '@azure/msal-browser';
import { AUTH_CONFIG } from '../config/env';

const msalConfig: Configuration = {
  auth: {
    clientId: AUTH_CONFIG.clientId || 'local-client-id',
    // Use the specific tenant so Microsoft doesn't route through the consumer
    // (personal account) endpoint, which rejects app registrations that are
    // not enabled for consumers. Fall back to 'common' only if tenantId is
    // missing (should not happen in practice).
    authority: `https://login.microsoftonline.com/${AUTH_CONFIG.tenantId || 'common'}`,
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
