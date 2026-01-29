/**
 * Suppress debug messages from Vite HMR and Codespaces infrastructure
 * This intercepts console.log and filters out unwanted debug messages
 * Only runs in development mode to avoid interfering with production monitoring
 * 
 * Also provides polyfills for browser APIs that may not be available in all
 * environments (e.g., Codespaces iframes)
 * 
 * Special handling for logger utility:
 * - Uses a unique symbol to mark calls from the logger utility
 * - Logger utility calls are never suppressed to avoid interfering with application logs
 */

// Polyfill for Notification API if not available
// This prevents "Can't find variable: Notification" errors in environments
// where the Notification API is not available (e.g., GitHub Codespaces iframes)
if (typeof window !== 'undefined' && typeof window.Notification === 'undefined') {
  // Create a stub Notification class that does nothing
  // This allows code that checks for Notification to work without errors
  (window as Window & { Notification?: typeof Notification }).Notification = class NotificationStub {
    static permission: NotificationPermission = 'denied';
    static requestPermission(): Promise<NotificationPermission> {
      return Promise.resolve('denied');
    }
    constructor(_title: string, _options?: NotificationOptions) {
      // Stub constructor - does nothing
    }
  } as unknown as typeof Notification;
}

// Unique symbol to mark logger utility calls
// Using regular Symbol() to create a truly private marker that can only be accessed through the export
const LOGGER_MARKER = Symbol('__LOGGER_UTILITY_MARKER__');

// Export marker for use by logger utility
export { LOGGER_MARKER };

// Only intercept console in development mode
if (import.meta.env.DEV) {
  // Store original console methods
  const originalLog = console.log;
  const originalDebug = console.debug;
  const originalWarn = console.warn;
  const originalError = console.error;

  // List of specific patterns to suppress from Vite HMR and Codespaces
  // Examples of messages that will be suppressed:
  // - "[vite] DEBUG connecting..." - Vite HMR debug messages
  // - "DEBUG[vite] connected." - Vite debug output
  // - "DEBUGvscs:web-client:e360:codespaces-component..." - Codespaces web client debug
  // - "tunnelClient verbose 9101: Sending #286..." - Codespaces tunnel client verbose messages
  // - "ERROR%c  ERR color: #f33 Can't find variable: Notification" - VS Code workbench errors
  const suppressPatterns = [
    /^\[vite\].*DEBUG/,       // Vite debug messages starting with [vite] DEBUG
    /^DEBUG\[vite\]/,         // DEBUG[vite] messages
    /^DEBUGvscs:web-client/,  // Codespaces web client debug
    /^tunnelClient verbose/,  // Codespaces tunnel client verbose messages (anchored to start)
    /^ERROR%c.*Can't find variable: Notification/,  // VS Code workbench Notification API errors
  ];

  // Helper function to check if message should be suppressed
  const shouldSuppress = (args: unknown[]): boolean => {
    // Early exit for empty args
    if (args.length === 0) return false;
    
    // Check if this is a call from the logger utility
    // Logger utility adds the marker as the first argument
    if (args[0] === LOGGER_MARKER) {
      return false; // Never suppress logger utility calls
    }
    
    return args.some(arg => {
      if (typeof arg === 'string') {
        return suppressPatterns.some(pattern => pattern.test(arg));
      }
      return false;
    });
  };

  // Helper to remove marker before passing to original console
  const removeMarker = (args: unknown[]): unknown[] => {
    if (args[0] === LOGGER_MARKER) {
      return args.slice(1);
    }
    return args;
  };

  // Override console.log
  console.log = function(...args: unknown[]): void {
    if (!shouldSuppress(args)) {
      originalLog.apply(console, removeMarker(args));
    }
  };

  // Override console.debug
  console.debug = function(...args: unknown[]): void {
    if (!shouldSuppress(args)) {
      originalDebug.apply(console, removeMarker(args));
    }
  };

  // Override console.warn - logger utility calls should never be suppressed
  console.warn = function(...args: unknown[]): void {
    originalWarn.apply(console, removeMarker(args));
  };

  // Override console.error - logger utility calls should never be suppressed
  console.error = function(...args: unknown[]): void {
    originalError.apply(console, removeMarker(args));
  };
}

export {};
