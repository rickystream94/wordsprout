import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
                name: 'vocabook-score-sync',
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
});

