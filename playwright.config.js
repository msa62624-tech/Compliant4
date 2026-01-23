// Playwright configuration for minimal E2E test with video recording
const { devices } = require('@playwright/test');

module.exports = {
  testDir: './e2e',
  timeout: 60 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  reporter: [['list'], ['junit', { outputFile: 'playwright-junit.xml' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15 * 1000,
    trace: 'off'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], video: 'on' }
    }
  ],
  // Allow overriding base URL via env var
  globalSetup: undefined,
  webServer: undefined
};
