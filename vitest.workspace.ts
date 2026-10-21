import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node', setupFiles: ['tests/api/env.ts'] } },
  {
    test: {
      name: 'api', include: ['tests/api/**/*.test.ts'], environment: 'node',
      globalSetup: ['tests/api/global-setup.ts'], setupFiles: ['tests/api/env.ts'],
      pool: 'forks', poolOptions: { forks: { singleFork: true } }, testTimeout: 30_000, hookTimeout: 60_000,
    },
  },
  {
    plugins: [(await import('@vitejs/plugin-react')).default()],
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
    test: { name: 'web', include: ['tests/web/**/*.test.tsx'], environment: 'jsdom', setupFiles: ['tests/web/setup.ts'], globals: true },
  },
]);
