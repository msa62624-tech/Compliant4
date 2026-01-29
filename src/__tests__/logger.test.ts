/**
 * Tests for logger utility with console suppression protection
 * Validates that logger messages are never suppressed
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '@/utils/logger';

describe('Logger utility', () => {
  let logSpy: ReturnType<typeof vi.fn>;
  let debugSpy: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.fn>;
  let errorSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create spies for console methods
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Logger marker protection', () => {
    it('should call console.log with LOGGER_MARKER for log method', () => {
      logger.log('Test message');
      
      // Should have been called with marker as first argument
      expect(logSpy).toHaveBeenCalled();
      const firstArg = logSpy.mock.calls[0][0];
      
      // First argument should be the LOGGER_MARKER symbol
      expect(typeof firstArg).toBe('symbol');
    });

    it('should call console.log with LOGGER_MARKER for info method', () => {
      logger.info('Test info');
      
      expect(logSpy).toHaveBeenCalled();
      const firstArg = logSpy.mock.calls[0][0];
      expect(typeof firstArg).toBe('symbol');
    });

    it('should call console.warn with LOGGER_MARKER for warn method', () => {
      logger.warn('Test warning');
      
      expect(warnSpy).toHaveBeenCalled();
      const firstArg = warnSpy.mock.calls[0][0];
      expect(typeof firstArg).toBe('symbol');
    });

    it('should call console.error with LOGGER_MARKER for error method', () => {
      logger.error('Test error');
      
      expect(errorSpy).toHaveBeenCalled();
      const firstArg = errorSpy.mock.calls[0][0];
      expect(typeof firstArg).toBe('symbol');
    });

    it('should call console.debug with LOGGER_MARKER for debug method', () => {
      logger.debug('Test debug');
      
      expect(debugSpy).toHaveBeenCalled();
      const firstArg = debugSpy.mock.calls[0][0];
      expect(typeof firstArg).toBe('symbol');
    });
  });

  describe('Logger with problematic content', () => {
    it('should log messages containing DEBUG[vite] without issues', () => {
      const message = 'User mentioned DEBUG[vite] in their message';
      logger.log(message);
      
      expect(logSpy).toHaveBeenCalled();
      // Verify the message is in the arguments (after the marker)
      const args = logSpy.mock.calls[0];
      // Skip the first argument (marker symbol) and check the rest
      expect(args.slice(1).join(' ')).toContain(message);
    });

    it('should log messages containing tunnelClient verbose without issues', () => {
      const message = 'Configuration: tunnelClient verbose mode is enabled';
      logger.info(message);
      
      expect(logSpy).toHaveBeenCalled();
      const args = logSpy.mock.calls[0];
      expect(args.slice(1).join(' ')).toContain(message);
    });

    it('should log messages containing DEBUGvscs:web-client without issues', () => {
      const message = 'DEBUGvscs:web-client component loaded';
      logger.warn(message);
      
      expect(warnSpy).toHaveBeenCalled();
      const args = warnSpy.mock.calls[0];
      expect(args.slice(1).join(' ')).toContain(message);
    });

    it('should log messages that start with suppression patterns', () => {
      const messages = [
        'DEBUG[vite] is mentioned in documentation',
        'tunnelClient verbose logs should be reviewed',
        'DEBUGvscs:web-client configuration'
      ];

      messages.forEach((msg) => {
        vi.clearAllMocks();
        logger.log(msg);
        
        expect(logSpy).toHaveBeenCalledTimes(1);
        const args = logSpy.mock.calls[0];
        expect(args.slice(1).join(' ')).toContain(msg);
      });
    });
  });

  describe('Logger context handling', () => {
    it('should pass context along with marker', () => {
      const context = { userId: '123', action: 'login' };
      logger.info('User action', context);
      
      expect(logSpy).toHaveBeenCalled();
      const args = logSpy.mock.calls[0];
      
      // First arg is marker, second is message, third is context
      expect(typeof args[0]).toBe('symbol');
      expect(args[1]).toBe('User action');
      expect(args[2]).toEqual(context);
    });
  });

  describe('Performance logging', () => {
    it('should include marker in performance logs', () => {
      logger.performance('API call', 150);
      
      expect(logSpy).toHaveBeenCalled();
      const firstArg = logSpy.mock.calls[0][0];
      expect(typeof firstArg).toBe('symbol');
    });
  });
});
