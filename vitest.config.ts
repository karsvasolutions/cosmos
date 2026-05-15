import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['ingest/__tests__/**/*.test.ts'],
    globals: false,
  },
});
