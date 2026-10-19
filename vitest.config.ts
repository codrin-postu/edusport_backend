import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/admin/**', 'src/plugins/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
  },
});
