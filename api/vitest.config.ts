import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: [
        'src/**/__mocks__/**',
        'src/services/cosmos.mock.ts',
        'src/services/cosmos.ts',
        'src/models/**',
        'src/utils/http.ts',
        // Not yet tested
        'src/functions/accessRequests.ts',
        'src/functions/languages.ts',
        'src/functions/phrasebooks.ts',
        'src/functions/tags.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 65,
        branches: 60,
      },
    },
  },
});
