import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['test-utils/setup.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 65,
        statements: 70,
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/index.ts',
        'src/http.ts',
        'src/functions.ts',
        'src/server.ts',
        'src/tools/render-chart.ts',
        'src/tools/render-table.ts',
        'src/tools/render-map.ts',
        'src/tools/fetch-image.ts',
      ],
    },
  },
});
