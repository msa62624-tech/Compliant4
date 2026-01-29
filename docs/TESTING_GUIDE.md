# Testing Guide

This document describes the testing strategy and how to run tests for the Compliant.team application.

## Overview

The project uses multiple testing frameworks:

- **Vitest** - For frontend unit and component tests
- **Jest** - For backend API tests  
- **Playwright** - For end-to-end (E2E) tests
- **React Testing Library** - For component testing utilities

## Frontend Testing (Vitest)

### Running Frontend Tests

```bash
# Run all frontend tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Structure

Frontend tests are located in `src/__tests__/` directory:

- **Component tests** (`.test.jsx`) - Test React components
- **Utility tests** (`.test.js`) - Test utility functions and business logic
- **Setup file** (`setup.js`) - Configures testing environment

### Example Tests

**Component Test Example:**
```javascript
// src/__tests__/badge.test.jsx
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/badge';

test('renders badge with text', () => {
  render(<Badge>Test Badge</Badge>);
  expect(screen.getByText('Test Badge')).toBeInTheDocument();
});
```

**Utility Test Example:**
```javascript
// src/__tests__/htmlEscaping.test.js
import { escapeHtml } from '@/utils/htmlEscaping';

test('escapes HTML characters', () => {
  const input = '<script>alert("XSS")</script>';
  const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;';
  expect(escapeHtml(input)).toBe(expected);
});
```

## Backend Testing (Pytest)

### Running Backend Tests

```bash
cd backend-python
pytest
```

### Test Structure

Backend tests are located in `backend-python/tests/` directory:

- **API tests** - Test REST endpoints
- **Authentication tests** - Test login and token handling
- **CRUD tests** - Test create, read, update, delete operations

### Example Backend Test

```javascript
// backend/__tests__/api.test.js
test('POST /auth/login - should login with valid credentials', async () => {
  const response = await request(BASE_URL)
    .post('/auth/login')
    .send({
      username: 'admin',
      password: 'INsure2026!'
    })
    .expect(200);

  expect(response.body).toHaveProperty('accessToken');
});
```

## End-to-End Testing (Playwright)

### Running E2E Tests

```bash
# Install Playwright browsers (first time only)
npm run playwright:install

# Run E2E tests
npm run test:e2e

# Run all E2E tests (installs browsers and runs tests)
npm run test:e2e:all
```

### Test Structure

E2E tests are located in `e2e/` directory:

- Tests use `.spec.js` extension
- Tests interact with the full application stack
- Captures screenshots and videos for debugging

### Example E2E Test

```javascript
// e2e/example.spec.js
test('visit frontend root', async ({ page }) => {
  await page.goto('http://localhost:5175');
  await page.screenshot({ path: 'e2e/screenshot-root.png' });
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});
```

## Test Coverage

### Current Test Coverage

**Frontend Tests:**
- ✅ Policy Trade Validator (6 tests)
- ✅ HTML Escaping utility (12 tests)
- ✅ Date Calculations utility (9 tests)
- ✅ Badge component (5 tests)
- ✅ Card component (3 tests)

**Total: 35 frontend tests**

**Backend Tests:**
- Authentication (login, invalid credentials, missing fields)
- Entity endpoints (Contractor, Project, User)
- CRUD operations (create, read, update, delete)
- Health checks

**E2E Tests:**
- Frontend smoke test (page load, screenshot)

### Viewing Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# Open coverage report in browser
open coverage/index.html
```

## Writing New Tests

### Frontend Component Test Template

```javascript
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { YourComponent } from '@/components/YourComponent';

describe('YourComponent', () => {
  test('renders correctly', () => {
    render(<YourComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Frontend Utility Test Template

```javascript
import { describe, test, expect } from 'vitest';
import { yourFunction } from '@/utils/yourUtility';

describe('yourFunction', () => {
  test('handles expected input', () => {
    const result = yourFunction('input');
    expect(result).toBe('expectedOutput');
  });
  
  test('handles edge cases', () => {
    expect(yourFunction(null)).toBe('');
    expect(yourFunction(undefined)).toBe('');
  });
});
```

### Backend API Test Template

```javascript
test('GET /endpoint - should return data', async () => {
  const response = await request(BASE_URL)
    .get('/endpoint')
    .set('Authorization', `Bearer ${authToken}`)
    .expect(200);

  expect(Array.isArray(response.body)).toBe(true);
});
```

## Best Practices

1. **Test Isolation** - Each test should be independent and not rely on other tests
2. **Clear Test Names** - Use descriptive test names that explain what is being tested
3. **Arrange-Act-Assert** - Structure tests with setup, execution, and verification
4. **Mock External Dependencies** - Mock API calls, timers, and external services
5. **Test Edge Cases** - Include tests for null, undefined, empty, and boundary values
6. **Keep Tests Fast** - Unit tests should run quickly; use integration tests sparingly

## Continuous Integration

Tests are automatically run on:
- Pull request creation
- Push to main branch
- Manual workflow dispatch

### CI Configuration

See `.github/workflows/` for CI configuration files.

## Debugging Tests

### Frontend Tests

```bash
# Run specific test file
npm test -- src/__tests__/badge.test.jsx

# Run tests matching pattern
npm test -- --grep "Badge"

# Run in UI mode for debugging
npm run test:ui
```

### Backend Tests

```bash
cd backend-python

# Run specific test file
pytest tests/test_api.py

# Run in verbose mode
pytest -v
```

### E2E Tests

```bash
# Run in headed mode (see browser)
npx playwright test --headed

# Run with debugging
npx playwright test --debug
```

## Common Issues

### Frontend Tests Failing

- Ensure all dependencies are installed: `npm install`
- Check that vitest config excludes node_modules and backend tests
- Verify component imports use correct aliases (@/)

### Backend Tests Failing

- Ensure backend server is not already running on port 3001
- Check that .env file exists in backend directory
- Verify Jest is configured for ES modules

### E2E Tests Failing

- Install Playwright browsers: `npm run playwright:install`
- Ensure both frontend and backend are running
- Check PLAYWRIGHT_BASE_URL environment variable

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Supertest Documentation](https://github.com/ladjs/supertest)
