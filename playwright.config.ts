import { defineConfig, devices } from '@playwright/test';

const API_ENV = {
  NODE_ENV: 'development', API_PORT: '4000', APP_URL: 'http://localhost:5173',
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgresql://isoft:isoft_dev_pw@localhost:5432/isoftstone_e2e',
  SESSION_SECRET: 'e2e-session-secret-e2e-session-secret-123456', PAYMENT_WEBHOOK_SECRET: 'e2e-webhook-secret-e2e-webhook-secret-12345',
  PAYMENT_PROVIDER: 'dev_simulator', TRADING_PROVIDER: 'demo', LOG_LEVEL: 'silent',
};

export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: process.env.CI ? 1 : 0, reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ }],
  webServer: [
    { command: 'npx tsx server/dev.ts', url: 'http://localhost:4000/api/v1/health', env: API_ENV, reuseExistingServer: !process.env.CI, timeout: 60_000 },
    { command: 'npx vite build && npx vite preview --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 180_000 },
  ],
});
