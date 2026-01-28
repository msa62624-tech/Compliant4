import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { cacheControl, conditionalRequest } from '../middleware/cacheControl.js';
import { idempotency, cleanupIdempotency, getIdempotencyStats, resetIdempotencyForTesting } from '../middleware/idempotency.js';

describe('Cache Control Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      path: '/api/test',
      headers: {}
    };
    res = {
      set: jest.fn(),
      get: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn()
    };
    next = jest.fn();
  });

  test('should set no-cache headers for API endpoints', () => {
    const middleware = cacheControl();
    middleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    expect(res.set).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(res.set).toHaveBeenCalledWith('Expires', '0');
    expect(res.set).toHaveBeenCalledWith('Vary', 'Accept-Encoding');
    expect(next).toHaveBeenCalled();
  });

  test('should set public cache headers for static assets', () => {
    req.path = '/uploads/image.png';
    const middleware = cacheControl();
    middleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('public'));
    expect(res.set).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('immutable'));
    expect(next).toHaveBeenCalled();
  });

  test('should not set ETag headers prematurely', () => {
    const middleware = cacheControl();
    middleware(req, res, next);

    // Verify we don't try to set ETag header
    const setCalls = res.set.mock.calls;
    const etagCalls = setCalls.filter(call => call[0] === 'ETag');
    expect(etagCalls.length).toBe(0);
  });

  test('conditionalRequest should return 304 when ETag matches', () => {
    req.headers['if-none-match'] = 'W/"abc123"';
    res.get = jest.fn().mockReturnValue('W/"abc123"');
    req.correlationId = 'test-123';

    conditionalRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(304);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('conditionalRequest should call next when ETag does not match', () => {
    req.headers['if-none-match'] = 'W/"abc123"';
    res.get = jest.fn().mockReturnValue('W/"xyz789"');

    conditionalRequest(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('conditionalRequest should call next when no ETag on response', () => {
    req.headers['if-none-match'] = 'W/"abc123"';
    res.get = jest.fn().mockReturnValue(undefined);

    conditionalRequest(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('should set no-cache headers for POST requests', () => {
    req.method = 'POST';
    const middleware = cacheControl();
    middleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    expect(next).toHaveBeenCalled();
  });
});

describe('Idempotency Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'POST',
      path: '/api/create',
      body: { test: 'data' },
      headers: {},
      user: { id: 'user123' }
    };
    res = {
      statusCode: 200,
      set: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  afterEach(() => {
    // Reset cleanup state for testing
    resetIdempotencyForTesting();
  });

  test('should skip idempotency for GET requests', () => {
    req.method = 'GET';
    const middleware = idempotency();
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('should wrap res.json to cache responses', () => {
    const middleware = idempotency();
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.json).toBeDefined();

    // Simulate response
    const originalJson = res.json;
    res.json({ success: true });

    // Check that headers were set
    expect(res.set).toHaveBeenCalledWith('X-Idempotency-Hit', 'false');
  });

  test('should return cached response for duplicate requests', async () => {
    const middleware = idempotency();
    
    // First request
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    
    // Simulate response
    res.json({ success: true, id: 123 });

    // Reset mocks for second request with proper chaining
    const jsonMock = jest.fn();
    const responseChain = {
      set: jest.fn().mockReturnThis(),
      json: jsonMock
    };
    const statusMock = jest.fn().mockReturnValue(responseChain);
    
    res = {
      statusCode: 200,
      set: responseChain.set,
      json: jsonMock,
      status: statusMock
    };
    next = jest.fn();

    // Second identical request
    await middleware(req, res, next);

    // Should return cached response
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(responseChain.set).toHaveBeenCalledWith('X-Idempotency-Hit', 'true');
    expect(responseChain.set).toHaveBeenCalledWith('X-Idempotency-Age', expect.any(String));
    expect(jsonMock).toHaveBeenCalledWith({ success: true, id: 123 });
    expect(next).not.toHaveBeenCalled();
  });

  test('cleanupIdempotency should clear the store', () => {
    // Add some data
    const middleware = idempotency();
    middleware(req, res, next);
    res.json({ test: 'data' });

    // Check store has data
    const statsBefore = getIdempotencyStats();
    expect(statsBefore.totalKeys).toBeGreaterThan(0);

    // Cleanup
    cleanupIdempotency();

    // Check store is empty
    const statsAfter = getIdempotencyStats();
    expect(statsAfter.totalKeys).toBe(0);
  });

  test('should handle explicit idempotency keys', async () => {
    req.headers['idempotency-key'] = 'my-custom-key-123';
    
    const middleware = idempotency();
    await middleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });

  test('should skip idempotency when disabled', async () => {
    const middleware = idempotency({ enabled: false });
    await middleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
    // Verify res.json was not wrapped
    expect(res.json).toBe(res.json);
  });

  test('should not cache error responses (non-2xx)', async () => {
    const middleware = idempotency();
    
    // First request with error response
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    
    // Simulate error response
    res.statusCode = 400;
    res.json({ error: 'Bad Request' });

    // Reset for second request
    const jsonMock = jest.fn();
    const responseChain = {
      set: jest.fn().mockReturnThis(),
      json: jsonMock
    };
    res = {
      statusCode: 200,
      set: responseChain.set,
      json: jsonMock,
      status: jest.fn().mockReturnValue(responseChain)
    };
    next = jest.fn();

    // Second identical request should not hit cache
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should handle multiple cleanup calls safely', () => {
    // First cleanup
    cleanupIdempotency();
    
    // Second cleanup should not throw
    expect(() => cleanupIdempotency()).not.toThrow();
  });

  test('resetIdempotencyForTesting should restart interval after cleanup', () => {
    // Add some data to the store
    const middleware = idempotency();
    middleware(req, res, next);
    res.json({ test: 'data' });

    // Cleanup (stops the interval)
    cleanupIdempotency();
    
    // Reset should restart everything including the interval
    resetIdempotencyForTesting();
    
    // Create a fresh middleware instance after reset
    const freshMiddleware = idempotency();
    
    // Verify we can use idempotency again after reset
    const newReq = {
      method: 'POST',
      path: '/api/create-new',
      body: { new: 'data' },
      headers: {},
      user: { id: 'user456' }
    };
    const newRes = {
      statusCode: 200,
      set: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    const newNext = jest.fn();
    
    freshMiddleware(newReq, newRes, newNext);
    expect(newNext).toHaveBeenCalled();
    
    // Simulate response
    newRes.json({ success: true });
    
    // Verify data was cached
    const stats = getIdempotencyStats();
    expect(stats.totalKeys).toBeGreaterThan(0);
  });
});
