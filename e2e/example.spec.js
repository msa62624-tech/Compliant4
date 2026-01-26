const { test, expect } = require('@playwright/test');

// Base URL can be overridden with PLAYWRIGHT_BASE_URL env var
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5175';

test('visit frontend root and capture screenshot + simple assertion', async ({ page }) => {
  // Video recording is enabled by project config; ensure directory
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // Basic smoke assertion: page loads and has a title
  const title = await page.title();
  console.log('PAGE TITLE:', title);
  // Save a screenshot for quick debugging
  await page.screenshot({ path: 'e2e/screenshot-root.png', fullPage: true });
  expect(title.length).toBeGreaterThan(0);
});
