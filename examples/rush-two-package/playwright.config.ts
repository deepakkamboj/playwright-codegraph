import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/store-app/tests',
  fullyParallel: true,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:3100',
  },
  webServer: {
    command: 'npx tsx apps/store-app/src/server.ts',
    url: 'http://127.0.0.1:3100/health',
    reuseExistingServer: false,
  },
});
