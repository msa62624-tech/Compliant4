# Test Configuration

## Backend Tests

### Authentication Tests

The backend tests require valid credentials to test authentication endpoints.

#### Development Mode
In development, tests use the default admin credentials unless overridden:
- Default username: `admin`
- Default password: `INsure2026!`

These match the default admin account created in `backend/utils/users.js`.

#### CI/CD and Production Testing
For CI/CD pipelines or testing against non-development environments, set these environment variables:

```bash
export TEST_USERNAME="your_test_username"
export TEST_PASSWORD="your_test_password"
export TEST_BASE_URL="http://localhost:3001"  # or your test server URL
```

#### Running Tests

```bash
# Development (uses defaults)
cd backend
npm test

# CI/CD (with custom credentials)
TEST_USERNAME=admin TEST_PASSWORD=secure_password npm test

# Against different server
TEST_BASE_URL=https://test.example.com npm test
```

### Security Note

The test file includes fallback credentials (`admin` / `INsure2026!`) for development convenience. These are:
- **Only used in development** when TEST_USERNAME/TEST_PASSWORD are not set
- Match the default admin account password hash in `backend/config/env.js`  
- Should be rotated before production deployment

For production testing:
1. Always set TEST_USERNAME and TEST_PASSWORD explicitly
2. Never use default credentials in production environments
3. Use strong, unique passwords for test accounts
4. Rotate test credentials regularly

## Frontend Tests

Frontend tests use Vitest and do not require authentication credentials.

```bash
npm test
```

## E2E Tests

End-to-end tests use Playwright and may require additional configuration.

```bash
npm run test:e2e
```
