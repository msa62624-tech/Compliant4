# E2E Test Documentation

## Overview

This directory contains end-to-end (E2E) tests for the compliant.team insurance tracking application using Playwright, including tests for the admin interface and all public portals.

## Test Files

### 1. `example.spec.js`
Basic smoke test that:
- Visits the frontend root page
- Captures a screenshot
- Verifies the page loads successfully

### 2. `full-e2e.spec.js` - Admin Interface Test
Comprehensive end-to-end test covering the complete admin workflow:

### 3. `portals.spec.js` - Public Portals Test Suite
Comprehensive tests for all three public portals (GC, Broker, Subcontractor)

### 4. `integrated-workflow.spec.js` ⭐ **NEW - Complete Integrated Workflow**
Full multi-user workflow test that exercises the entire system:

#### Integrated Workflow Coverage:
1. **Phase 1: Admin Setup**
   - Admin login
   - Create General Contractor
   - Create/access Insurance Programs

2. **Phase 2: GC Portal**
   - Navigate to GC login
   - Verify GC portal accessibility
   - Test authentication flows

3. **Phase 3: Broker Portal**
   - Navigate to Broker login
   - Verify Broker portal accessibility
   - Test upload functionality access

4. **Phase 4: Subcontractor Portal**
   - Access subcontractor dashboard
   - Verify portal functionality

5. **Phase 5: Admin Review**
   - Navigate to documents
   - Access pending reviews
   - Verify review workflow

#### Video Recording 🎥
**All tests are recorded with video!** Playwright automatically captures video of every test execution:
- Videos are saved in `e2e/videos/` directory
- Main integrated workflow video: `integrated-workflow-complete.webm`
- Videos help debug failures and document test execution
- Configured in `playwright.config.js` with `video: 'on'`

#### Integrated Test Screenshots
The integrated workflow captures 12 screenshots:
- `integrated-01-admin-login.png` - Admin login page
- `integrated-02-contractors-page.png` - Contractors listing
- `integrated-03-gc-form-filled.png` - GC creation form filled
- `integrated-04-gc-created.png` - GC successfully created
- `integrated-05-programs-page.png` - Insurance programs page
- `integrated-06-gc-login-page.png` - GC portal login
- `integrated-08-broker-login-page.png` - Broker portal login
- `integrated-10-sub-dashboard.png` - Subcontractor dashboard
- `integrated-11-admin-documents.png` - Admin documents page
- `integrated-12-admin-reviews.png` - Admin reviews page

### Admin Interface Test (`full-e2e.spec.js`)

#### Test Coverage:
1. **Login Flow**
   - Authenticates with admin credentials
   - Verifies successful login

2. **Contractors Management**
   - Navigates to Contractors page
   - Creates a new General Contractor
   - Fills in company details (name, email, phone)

3. **Documents Management**
   - Navigates to Documents page
   - Verifies document listing

4. **Messaging Center**
   - Navigates to Messages page
   - Verifies messaging interface

5. **Pending Reviews**
   - Navigates to Pending Reviews page
   - Verifies review dashboard

6. **Insurance Programs**
   - Navigates to Programs page
   - Verifies program management interface

7. **Dashboard Navigation**
   - Returns to main Dashboard
   - Verifies navigation functionality

8. **Logout Flow**
   - Tests logout functionality
   - Captures final state

#### Screenshots
The test captures 11 screenshots showing each step of the workflow:
- `01-login-page.png` - Login page
- `02-dashboard.png` - Main dashboard after login
- `03-contractors-page.png` - Contractors listing
- `04-create-gc-form.png` - GC creation form
- `05-contractors-after-create.png` - Contractors page after creating GC
- `06-documents-page.png` - Documents page
- `07-messages-page.png` - Messages page
- `08-pending-reviews.png` - Pending reviews page
- `09-insurance-programs.png` - Insurance programs page
- `10-dashboard-final.png` - Dashboard after navigation
- `11-logout-attempt.png` - Logout state

#### Backend Connectivity Test
Separate test that verifies:
- Backend API connectivity
- Authentication flow
- API response handling

### 3. `portals.spec.js` ⭐ **New Public Portals Test Suite**
Comprehensive tests for all three public portals (GC, Broker, Subcontractor):

#### GC Portal Tests:
1. **Login Page Access** - Verifies GC login form is accessible
2. **Dashboard Authentication** - Tests authentication redirect from dashboard
3. **Portal Navigation** - Validates GC-specific routes

#### Broker Portal Tests:
1. **Login Page Access** - Verifies Broker login form is accessible
2. **Dashboard Authentication** - Tests authentication redirect from dashboard
3. **Upload COI Page** - Verifies upload functionality page accessibility
4. **Upload Page** - Tests document upload routes

#### Subcontractor Portal Tests:
1. **Dashboard Access** - Tests subcontractor dashboard loading
2. **Dashboard with ID** - Verifies ID parameter handling
3. **Broker Verification** - Tests broker verification page for subs

#### Combined Navigation Test:
- Tests all portal URLs for accessibility
- Verifies proper redirects and authentication flows
- Generates summary of portal accessibility

#### Portal Screenshots:
The portal tests capture screenshots for each portal:
- `gc-01-login-page.png` - GC login page
- `gc-02-login-form.png` - GC login form
- `gc-03-dashboard-redirect.png` - GC dashboard auth redirect
- `broker-01-login-page.png` - Broker login page
- `broker-02-login-form.png` - Broker login form
- `broker-03-dashboard-redirect.png` - Broker dashboard auth redirect
- `broker-04-upload-coi-page.png` - Broker upload COI page
- `sub-01-dashboard-page.png` - Subcontractor dashboard
- `sub-02-dashboard-with-id.png` - Subcontractor dashboard with ID
- `sub-03-broker-verification.png` - Broker verification page
- `portals-navigation-summary.png` - Navigation summary

## Prerequisites

- Node.js and npm installed
- Frontend running at `http://localhost:5175` (or set `PLAYWRIGHT_BASE_URL`)
- Backend running at `http://localhost:3001`

## Installation

Install Playwright and browsers (one-time setup):

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Or use the combined command:

```bash
npm run playwright:install
```

## Running Tests

### Run all tests:
```bash
npm run test:e2e
```

Or directly with Playwright:
```bash
npx playwright test --project=chromium
```

### Run specific test suite:
```bash
# Admin interface tests
npx playwright test e2e/full-e2e.spec.js --project=chromium

# Public portals tests
npx playwright test e2e/portals.spec.js --project=chromium

# Basic smoke test
npx playwright test e2e/example.spec.js --project=chromium
```

### Run with custom base URL:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:5175 npx playwright test --project=chromium
```

## Test Configuration

Configuration is in `playwright.config.js`:
- **Browser**: Chromium (Desktop Chrome)
- **Timeout**: 60 seconds per test
- **Video Recording**: Enabled for all tests
- **Viewport**: 1280x800
- **Headless**: true (runs without visible browser)

## Test Results

### Videos
Recorded videos are saved in `test-results/` directory for each test run.

### Screenshots
Screenshots are saved in `e2e/screenshots/` directory showing each step of the workflow.

### Reports
- Console output shows test progress with detailed logging
- JUnit XML report: `playwright-junit.xml`
- HTML report: Run `npx playwright show-report` after tests

## Default Test Credentials

As documented in the main README:

### Admin Interface
| Username | Password     | Role         |
|----------|--------------|--------------|
| admin    | INsure2026!  | super_admin  |

### Public Portals

The public portals (GC, Broker, Subcontractor) require specific credentials or links:

- **GC Portal**: Accessible at `/gc-login` - requires GC-specific credentials
- **Broker Portal**: Accessible at `/broker-login` - requires broker credentials  
- **Subcontractor Portal**: Accessible at `/subcontractor-dashboard` - typically accessed via unique links with ID parameters

**Note**: Portal tests verify page accessibility and authentication flows without requiring actual credentials. To test full portal workflows, you'll need to:
1. Create test accounts in the admin interface
2. Obtain login credentials or access links
3. Update test files with valid credentials

## CI/CD Integration

The tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
  env:
    PLAYWRIGHT_BASE_URL: http://localhost:5175
```

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.js`
- Ensure backend is running and accessible
- Check network connectivity

### Screenshots not generating
- Ensure `e2e/screenshots/` directory exists (created automatically)
- Check file permissions

### Login failing
- Verify backend is running on port 3001
- Check default credentials haven't changed
- Review backend logs for authentication errors

### Modal overlays blocking clicks
- Tests use `{ force: true }` option to handle modal overlays
- If new issues arise, add similar handling to new click actions

## Extending Tests

To add new test scenarios:

1. Create a new test file in `e2e/` directory
2. Import Playwright test utilities:
   ```javascript
   import { test, expect } from '@playwright/test';
   ```
3. Define test cases using `test()` and `test.describe()`
4. Use page object patterns for better maintainability
5. Capture screenshots at key points for debugging

## Best Practices

1. **Use semantic selectors**: Prefer text-based selectors for stability
2. **Handle asynchronous operations**: Use `waitForTimeout()` or `waitForSelector()`
3. **Capture screenshots**: Take screenshots at important workflow steps
4. **Use force clicks when needed**: Modal overlays may require `{ force: true }`
5. **Make tests resilient**: Handle cases where elements might not exist
6. **Log progress**: Use `console.log()` to track test execution

## Video Recording

All tests are recorded with video enabled. Videos are saved in:
- `test-results/[test-name]-[browser]/video.webm`

Videos help debug test failures by showing exactly what happened during the test run.
