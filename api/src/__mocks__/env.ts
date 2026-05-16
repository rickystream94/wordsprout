/** Safe defaults for all API environment variables — for use in unit tests. */
export const APP_ENV = 'local';
export const IS_LOCAL = true;
export const IS_DEV = false;
export const IS_PROD = false;
export const COSMOS_ENDPOINT = '';
export const COSMOS_DATABASE = 'test-db';
export const COSMOS_CONTAINER = 'test-container';
export const ENTRA_TENANT_ID = 'test-tenant-id';
export const ENTRA_CLIENT_ID = 'test-entra-client-id';
export const GOOGLE_CLIENT_ID = 'test-google-client-id';
export const AZURE_AI_ENDPOINT = 'https://test.openai.azure.com';
export const AZURE_AI_DEPLOYMENT = 'gpt-4o-mini';
export const AI_DAILY_ENRICHMENT_LIMIT = 20;
export const SESSION_SECRET = 'test-secret-for-hmac-sha256-at-least-32-chars-xxxx';
export const SESSION_ACCESS_TTL = 900;
export const SESSION_REFRESH_TTL = 604800;
