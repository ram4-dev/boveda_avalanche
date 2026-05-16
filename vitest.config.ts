import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: 'api',
          environment: 'node',
          globals: true,
          include: ['tests/**/*.test.ts']
        }
      },
      {
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          include: ['web/src/**/*.test.{ts,tsx}'],
          setupFiles: ['web/src/test/setup.ts']
        }
      }
    ]
  }
});
