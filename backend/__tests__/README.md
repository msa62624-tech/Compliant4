# Backend Tests

This directory contains API and integration tests for the Compliant.team backend.

## Test Files

- `api.test.js` - Comprehensive API endpoint tests including:
  - Authentication (login, token handling)
  - Entity CRUD operations (Contractor, Project, User)
  - Authorization checks
  - Health checks

## Running Tests

From the backend directory:

```bash
cd backend

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- __tests__/api.test.js
```

## Test Structure

### Authentication Tests
- Valid login with correct credentials
- Rejection of invalid credentials
- Missing field validation

### Entity Endpoint Tests
- Authorization requirements
- GET requests for Contractor, Project, User
- Array response validation

### CRUD Operation Tests
- CREATE: Post new contractor
- READ: Get contractor by ID
- UPDATE: Update contractor details
- DELETE: Delete contractor and verify

### Health Check Tests
- Server health endpoint
- Response format validation

## Writing Backend Tests

Use Supertest for HTTP testing:

```javascript
import request from 'supertest';

test('GET /endpoint - description', async () => {
  const response = await request(BASE_URL)
    .get('/endpoint')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
    
  expect(response.body).toBeDefined();
});
```

## Test Environment

Backend tests run with:
- `NODE_ENV=test`
- Separate test database (if configured)
- Port 3001 for test server

## Important Notes

1. Tests start a local backend server automatically
2. Server runs on port 3001 during tests
3. Authentication token is obtained once and reused
4. Tests clean up created resources
5. In-memory storage is used for testing

## Best Practices

- Use descriptive test names
- Test both success and error cases
- Clean up test data after tests
- Mock external dependencies
- Keep tests independent

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [Main Testing Guide](../docs/TESTING_GUIDE.md)
