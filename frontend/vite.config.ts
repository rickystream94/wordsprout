import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

type DeploymentMode = 'dev' | 'prod';

interface InfraConfig {
  environments?: Partial<Record<DeploymentMode, {
    entraClientId?: string;
    googleClientId?: string;
  }>>;
}

function getDeploymentDefines(mode: string): Record<string, string> | undefined {
  if (mode !== 'dev' && mode !== 'prod') return undefined;

  const config = JSON.parse(
    readFileSync(new URL('../infra/config.json', import.meta.url), 'utf8'),
  ) as InfraConfig;
  const deployment = config.environments?.[mode];
  const environment = loadEnv(mode, process.cwd(), '');
  const entraClientId = environment.VITE_ENTRA_CLIENT_ID || deployment?.entraClientId;
  const googleClientId = environment.VITE_GOOGLE_CLIENT_ID || deployment?.googleClientId;

  if (!entraClientId || !googleClientId) {
    throw new Error(`Missing identity client IDs for the '${mode}' environment in infra/config.json`);
  }

  return {
    'import.meta.env.VITE_APP_ENV': JSON.stringify(mode),
    'import.meta.env.VITE_ENTRA_CLIENT_ID': JSON.stringify(entraClientId),
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
  };
}

export default defineConfig(({ mode }) => ({
  define: getDeploymentDefines(mode),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'languages.json'],
      manifest: false, // using our own manifest.json in public/
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        runtimeCaching: [
          {
            // T035: Background Sync for PUT /api/entries/* score mutations (FR-024, FR-025)
            // Queues failed mutations when offline; replayed automatically via SW sync event
            // (Android Chrome). iOS Safari foreground fallback is wired in main.tsx.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/entries/'),
            method: 'PUT',
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'wordsprout-score-sync',
                options: {
                  maxRetentionTime: 24 * 60, // 24 hours in minutes
                },
              },
            },
          },
          {
            // Network-first for all other API calls
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
            },
          },
          {
            // Cache-first for languages.json (rarely changes)
            urlPattern: ({ url }) => url.pathname === '/languages.json',
            handler: 'CacheFirst',
            options: {
              cacheName: 'languages-cache',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
}));
