export type AppEnv = 'local' | 'dev' | 'prod';

const raw = import.meta.env.VITE_APP_ENV as string | undefined;
export const APP_ENV: AppEnv =
  raw === 'dev' || raw === 'prod' ? raw : 'local';

export const IS_LOCAL = APP_ENV === 'local';
export const IS_DEV = APP_ENV === 'dev';
export const IS_PROD = APP_ENV === 'prod';

/** AI enrichment is only available locally until Azure OpenAI quota is approved. */
export const FEATURES_AI_ENABLED = IS_LOCAL;

/** Base URL for all /api/* calls. In local stage points to the Functions emulator. */
export const API_BASE = IS_LOCAL
  ? 'http://localhost:7071/api'
  : '/api';

/** MSAL Entra ID config. */
export const AUTH_CONFIG = {
  clientId: import.meta.env.VITE_ENTRA_CLIENT_ID ?? '',
  tenantId: import.meta.env.VITE_ENTRA_TENANT_ID ?? '',
  redirectUri: import.meta.env.VITE_REDIRECT_URI ?? window.location.origin,
};

/** Google OAuth 2.0 client ID. */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
