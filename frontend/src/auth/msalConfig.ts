import { PublicClientApplication, type Configuration } from '@azure/msal-browser';
import { AUTH_CONFIG, IS_LOCAL } from '../config/env';

const msalConfig: Configuration = {
  auth: {
    clientId: AUTH_CONFIG.clientId || 'local-client-id',
    authority: IS_LOCAL
      ? 'https://login.microsoftonline.com/common'
      : `https://${AUTH_CONFIG.tenantName}.b2clogin.com/${AUTH_CONFIG.tenantName}.onmicrosoft.com/${AUTH_CONFIG.policy}`,
    knownAuthorities: IS_LOCAL
      ? []
      : [`${AUTH_CONFIG.tenantName}.b2clogin.com`],
    redirectUri: AUTH_CONFIG.redirectUri,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Initialise MSAL before the app renders — called from main.tsx
export async function initializeMsal() {
  await msalInstance.initialize();
  // Handle redirect response on page load
  await msalInstance.handleRedirectPromise();
}
