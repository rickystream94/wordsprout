export type AppEnv = 'local' | 'dev' | 'prod';

const raw = import.meta.env.VITE_APP_ENV as string | undefined;
export const APP_ENV: AppEnv =
  raw === 'dev' || raw === 'prod' ? raw : 'local';

export const IS_LOCAL = APP_ENV === 'local';
export const IS_DEV = APP_ENV === 'dev';
export const IS_PROD = APP_ENV === 'prod';

/** Base URL for all /api/* calls. In local stage points to the Functions emulator. */
export const API_BASE = IS_LOCAL
  ? 'http://localhost:7071/api'
  : '/api';

/** MSAL B2C config — values are empty strings in local stage (auth is bypassed). */
export const AUTH_CONFIG = {
  tenantName: import.meta.env.VITE_B2C_TENANT ?? '',
  policy: import.meta.env.VITE_B2C_POLICY ?? '',
  clientId: import.meta.env.VITE_B2C_CLIENT_ID ?? '',
  redirectUri: import.meta.env.VITE_REDIRECT_URI ?? window.location.origin,
};
