export type AppEnv = 'local' | 'dev' | 'prod';

const raw = process.env['APP_ENV'];
export const APP_ENV: AppEnv =
  raw === 'dev' || raw === 'prod' ? raw : 'local';

export const IS_LOCAL = APP_ENV === 'local';
export const IS_DEV = APP_ENV === 'dev';
export const IS_PROD = APP_ENV === 'prod';

export const COSMOS_ENDPOINT = process.env['COSMOS_ENDPOINT'] ?? '';
export const COSMOS_KEY = process.env['COSMOS_KEY'] ?? '';
export const COSMOS_DATABASE = process.env['COSMOS_DATABASE'] ?? 'vocabook';
export const COSMOS_CONTAINER = process.env['COSMOS_CONTAINER'] ?? 'data';

export const B2C_TENANT = process.env['B2C_TENANT'] ?? '';
export const B2C_POLICY = process.env['B2C_POLICY'] ?? '';
export const B2C_CLIENT_ID = process.env['B2C_CLIENT_ID'] ?? '';

export const AZURE_AI_ENDPOINT = process.env['AZURE_AI_ENDPOINT'] ?? '';
export const AZURE_AI_KEY = process.env['AZURE_AI_KEY'] ?? '';
export const AZURE_AI_DEPLOYMENT = process.env['AZURE_AI_DEPLOYMENT'] ?? 'gpt-4o-mini';
export const AI_QUOTA_LIMIT = parseInt(process.env['AI_QUOTA_LIMIT'] ?? '20', 10);
