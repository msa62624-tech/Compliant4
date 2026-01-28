import { describe, test, expect } from '@jest/globals';
import { blockInternalEntities } from '../middleware/auth.js';

describe('blockInternalEntities middleware', () => {
  test('should block access to entities starting with underscore for non-admin users', () => {
    const req = {
      params: { entityName: '_migrations' },
      user: { role: 'user', id: 'test-user' }
    };
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        return this;
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    blockInternalEntities(req, res, next);

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Access to internal entities is restricted');
  });

  test('should allow admin users to access internal entities', () => {
    const req = {
      params: { entityName: '_migrations' },
      user: { role: 'admin', id: 'admin-user' }
    };
    const res = {
      statusCode: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        return this;
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    blockInternalEntities(req, res, next);

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(null);
  });

  test('should allow super_admin users to access internal entities', () => {
    const req = {
      params: { entityName: '_migrations' },
      user: { role: 'super_admin', id: 'super-admin-user' }
    };
    const res = {
      statusCode: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        return this;
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    blockInternalEntities(req, res, next);

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(null);
  });

  test('should allow access to regular entities for all authenticated users', () => {
    const req = {
      params: { entityName: 'Contractor' },
      user: { role: 'user', id: 'test-user' }
    };
    const res = {
      statusCode: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        return this;
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    blockInternalEntities(req, res, next);

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(null);
  });

  test('should allow access when no entityName param exists', () => {
    const req = {
      params: {},
      user: { role: 'user', id: 'test-user' }
    };
    const res = {
      statusCode: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        return this;
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    blockInternalEntities(req, res, next);

    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(null);
  });
});
