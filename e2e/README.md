E2E test instructions

Run the Playwright E2E test (records video) locally.

Prerequisites:
- Node.js and npm installed
- Frontend running (Vite dev server) at `http://localhost:5175` or set `PLAYWRIGHT_BASE_URL`

Install Playwright and browsers (once):

```bash
npm install --save-dev @playwright/test
npx playwright install
```

Run tests (records video per test in `playwright-report` and `test-results`):

```bash
# optional: set base URL if your frontend runs on a different port
export PLAYWRIGHT_BASE_URL=http://localhost:5175
npx playwright test --project=chromium
```

Recorded videos and artifacts will be placed under `playwright-report` and `test-results` created by Playwright. Also `e2e/screenshot-root.png` will be created by the test.
