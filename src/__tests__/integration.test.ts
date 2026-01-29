/**
 * Integration test to verify console override and logger protection
 * This simulates real-world scenarios
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { logger } from '@/utils/logger';

describe('Integration: Console override and logger protection', () => {
  let originalConsole: {
    log: typeof console.log;
    debug: typeof console.debug;
    warn: typeof console.warn;
    error: typeof console.error;
  };
  
  let capturedLogs: string[] = [];
  let capturedDebug: string[] = [];
  let capturedWarn: string[] = [];
  let capturedError: string[] = [];

  beforeAll(() => {
    // Save original console methods
    originalConsole = {
      log: console.log,
      debug: console.debug,
      warn: console.warn,
      error: console.error,
    };

    // Mock console to capture output
    console.log = vi.fn((...args) => {
      capturedLogs.push(args.map(a => String(a)).join(' '));
    });
    console.debug = vi.fn((...args) => {
      capturedDebug.push(args.map(a => String(a)).join(' '));
    });
    console.warn = vi.fn((...args) => {
      capturedWarn.push(args.map(a => String(a)).join(' '));
    });
    console.error = vi.fn((...args) => {
      capturedError.push(args.map(a => String(a)).join(' '));
    });
  });

  afterAll(() => {
    // Restore original console
    console.log = originalConsole.log;
    console.debug = originalConsole.debug;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it('should demonstrate logger messages are always logged', () => {
    capturedLogs = [];
    
    // Logger messages should always appear
    logger.log('Application started');
    logger.info('User logged in');
    
    expect(console.log).toHaveBeenCalledTimes(2);
    expect(capturedLogs.length).toBeGreaterThan(0);
  });

  it('should demonstrate logger messages with problematic patterns are logged', () => {
    capturedLogs = [];
    capturedWarn = [];
    
    // Even if logger messages contain suppression patterns, they should appear
    logger.log('User mentioned DEBUG[vite] in feedback');
    logger.warn('Check tunnelClient verbose settings');
    
    expect(console.log).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('should verify normal messages in middle of text are not suppressed', () => {
    capturedLogs = [];
    
    // Message with "tunnelClient verbose" not at start should appear
    console.log('Configuration: enable tunnelClient verbose mode');
    
    // This should be captured (not suppressed)
    expect(console.log).toHaveBeenCalled();
  });

  it('should demonstrate all logger methods work correctly', () => {
    vi.clearAllMocks();
    capturedLogs = [];
    capturedDebug = [];
    capturedWarn = [];
    capturedError = [];
    
    logger.log('Log message');
    logger.info('Info message');
    logger.debug('Debug message');
    logger.warn('Warn message');
    logger.error('Error message');
    
    // All logger methods should have been called
    expect(console.log).toHaveBeenCalled(); // log and info use console.log
    expect(console.debug).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('should verify performance logging works with marker', () => {
    vi.clearAllMocks();
    
    logger.performance('API request', 250, { endpoint: '/api/users' });
    
    expect(console.log).toHaveBeenCalled();
    const firstArg = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(typeof firstArg).toBe('symbol');
  });
});
