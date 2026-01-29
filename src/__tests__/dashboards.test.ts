// Test that dashboard components are importable and have expected structure
import { expect, test, describe } from 'vitest';

describe('Dashboard Components Integrity', () => {
  test('GC Dashboard should be importable', async () => {
    const module = await import('@/components/GCDashboard.jsx');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });

  test('Broker Dashboard should be importable', async () => {
    const module = await import('@/components/BrokerDashboard.jsx');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });

  test('Subcontractor Dashboard should be importable', async () => {
    const module = await import('@/components/SubcontractorDashboard.jsx');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });

  test('Contractor Dashboard should be importable', async () => {
    const module = await import('@/components/ContractorDashboard.jsx');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });

  test('Admin Dashboard should be importable', async () => {
    const module = await import('@/components/AdminDashboard.jsx');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});

describe('Authentication Module Integrity', () => {
  test('auth module should export all required functions', async () => {
    const auth = await import('@/auth');
    expect(auth.getToken).toBeDefined();
    expect(auth.getValidToken).toBeDefined();
    expect(auth.setToken).toBeDefined();
    expect(auth.clearToken).toBeDefined();
    expect(auth.login).toBeDefined();
    expect(auth.refreshAccessToken).toBeDefined();
    expect(auth.getAuthHeader).toBeDefined();
    expect(auth.isConfigured).toBeDefined();
    expect(auth.isTokenExpired).toBeDefined();
  });

  test('validation module should export all required functions', async () => {
    const validation = await import('@/utils/validation');
    expect(validation.validate).toBeDefined();
    expect(validation.validateEmail).toBeDefined();
    expect(validation.validateUsername).toBeDefined();
    expect(validation.validatePassword).toBeDefined();
    expect(validation.validateLoginCredentials).toBeDefined();
    expect(validation.validateUrlParams).toBeDefined();
    expect(validation.sanitizeString).toBeDefined();
    expect(validation.isValidId).toBeDefined();
  });
});
