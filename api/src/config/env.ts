export type AppEnv = 'local' | 'dev' | 'prod';

const raw = process.env['APP_ENV'];
export const APP_ENV: AppEnv =
  raw === 'dev' || raw === 'prod' ? raw : 'local';

export const IS_LOCAL = APP_ENV === 'local';
export const IS_DEV = APP_ENV === 'dev';
export const IS_PROD = APP_ENV === 'prod';

export const COSMOS_ENDPOINT = process.env['COSMOS_ENDPOINT'] ?? '';
export const COSMOS_DATABASE = process.env['COSMOS_DATABASE'] ?? 'wordsprout';
export const COSMOS_CONTAINER = process.env['COSMOS_CONTAINER'] ?? 'data';

export const ENTRA_TENANT_ID = process.env['ENTRA_TENANT_ID'] ?? '';
export const ENTRA_CLIENT_ID = process.env['ENTRA_CLIENT_ID'] ?? '';
export const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID'] ?? '';

export const AZURE_AI_ENDPOINT = process.env['AZURE_AI_ENDPOINT'] ?? '';
export const AZURE_AI_DEPLOYMENT = process.env['AZURE_AI_DEPLOYMENT'] ?? 'gpt-4o-mini';
export const AI_DAILY_ENRICHMENT_LIMIT = parseInt(process.env['AI_DAILY_ENRICHMENT_LIMIT'] ?? '20', 10);
