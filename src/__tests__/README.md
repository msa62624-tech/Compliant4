# Frontend Tests

This directory contains unit and component tests for the Compliant.team frontend.

## Test Files

- `policyTradeValidator.test.js` - Tests for insurance policy trade validation logic
- `htmlEscaping.test.js` - Tests for HTML escaping security utilities
- `dateCalculations.test.js` - Tests for date calculation utilities
- `badge.test.jsx` - Tests for Badge UI component
- `card.test.jsx` - Tests for Card UI component
- `setup.js` - Test environment configuration

## Running Tests

From the root directory:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/__tests__/badge.test.jsx

# Run in watch mode
npm test -- --watch

# Run with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Writing Tests

### Component Tests

Use React Testing Library to test components:

```javascript
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

test('renders component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### Utility Tests

Test utility functions in isolation:

```javascript
import { myFunction } from '@/utils/myUtility';

test('handles input correctly', () => {
  expect(myFunction('input')).toBe('output');
});
```

## Test Coverage Goals

- All utility functions should have tests
- All UI components should have basic render tests
- Critical business logic should have comprehensive tests
- Security-related code should have thorough edge case testing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Main Testing Guide](../../docs/TESTING_GUIDE.md)
