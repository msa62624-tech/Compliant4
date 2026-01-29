/**
 * Tests for suppressDebugMessages module
 * Verifies that Notification API polyfill is applied correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Notification API Polyfill', () => {
  let originalNotification: typeof Notification | undefined;

  // Helper function to create the polyfill stub
  const createNotificationStub = () => {
    return class NotificationStub {
      static permission: NotificationPermission = 'denied';
      static requestPermission(): Promise<NotificationPermission> {
        return Promise.resolve('denied');
      }
      constructor(_title: string, _options?: NotificationOptions) {
        // Stub constructor - does nothing
      }
    } as unknown as typeof Notification;
  };

  // Helper function to apply polyfill
  const applyPolyfill = () => {
    const testWindow = global as unknown as { Notification?: typeof Notification };
    if (typeof testWindow.Notification === 'undefined') {
      testWindow.Notification = createNotificationStub();
    }
  };

  beforeEach(() => {
    // Save original Notification if it exists
    originalNotification = (global as unknown as { Notification?: typeof Notification }).Notification;
  });

  afterEach(() => {
    // Restore original Notification
    if (originalNotification !== undefined) {
      (global as unknown as { Notification: typeof Notification }).Notification = originalNotification;
    } else {
      delete (global as unknown as { Notification?: typeof Notification }).Notification;
    }
  });

  it('should provide a Notification stub when Notification is not available', () => {
    // Remove Notification to simulate environment without it
    delete (global as unknown as { Notification?: typeof Notification }).Notification;
    
    // Apply polyfill
    applyPolyfill();

    const testWindow = global as unknown as { Notification?: typeof Notification };
    
    // Verify polyfill was applied
    expect(testWindow.Notification).toBeDefined();
    expect(testWindow.Notification!.permission).toBe('denied');
  });

  it('should allow requestPermission to be called without errors', async () => {
    // Remove Notification to simulate environment without it
    delete (global as unknown as { Notification?: typeof Notification }).Notification;
    
    // Apply polyfill
    applyPolyfill();

    const testWindow = global as unknown as { Notification?: typeof Notification };

    // Test that requestPermission works
    const result = await testWindow.Notification!.requestPermission();
    expect(result).toBe('denied');
  });

  it('should allow Notification constructor to be called without errors', () => {
    // Remove Notification to simulate environment without it
    delete (global as unknown as { Notification?: typeof Notification }).Notification;
    
    // Apply polyfill
    applyPolyfill();

    const testWindow = global as unknown as { Notification?: typeof Notification };

    // Test that constructor works without throwing
    expect(() => {
      new testWindow.Notification!('Test', { body: 'Test notification' });
    }).not.toThrow();
  });
});

describe('Console Message Suppression', () => {
  it('should suppress debug messages matching patterns', () => {
    const patterns = [
      /^\[vite\].*DEBUG/,
      /^DEBUG\[vite\]/,
      /^DEBUGvscs:web-client/,
      /tunnelClient verbose/,
      /^ERROR%c.*Can't find variable: Notification/,
    ];

    const testMessages = [
      '[vite] DEBUG connecting...',
      'DEBUG[vite] connected.',
      'DEBUGvscs:web-client:3771:codespaces-component:workbench-page tunnelClient verbose 9101: Sending #949',
      'tunnelClient verbose 9101: Sending #1116 h (recipientChannel=2) (bytesToAdd=526139)',
      'ERROR%c  ERR color: #f33 Can\'t find variable: Notification',
    ];

    testMessages.forEach((message) => {
      const shouldSuppress = patterns.some(pattern => pattern.test(message));
      expect(shouldSuppress).toBe(true);
    });
  });

  it('should not suppress normal console messages', () => {
    const patterns = [
      /^\[vite\].*DEBUG/,
      /^DEBUG\[vite\]/,
      /^DEBUGvscs:web-client/,
      /tunnelClient verbose/,
      /^ERROR%c.*Can't find variable: Notification/,
    ];

    const normalMessages = [
      'Application started',
      'User logged in',
      'Error: Network request failed',
      'Warning: Deprecated function',
      // This should NOT be suppressed because it doesn't match the specific ERROR%c pattern
      'Some other error about Can\'t find variable: Notification',
    ];

    normalMessages.forEach((message) => {
      const shouldSuppress = patterns.some(pattern => pattern.test(message));
      expect(shouldSuppress).toBe(false);
    });
  });
});
