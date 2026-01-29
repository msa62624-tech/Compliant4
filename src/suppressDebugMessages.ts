/**
 * Suppress debug messages from Vite HMR and Codespaces infrastructure
 * This intercepts console.log and filters out unwanted debug messages
 * Only runs in development mode to avoid interfering with production monitoring
 * 
 * Also provides polyfills for browser APIs that may not be available in all
 * environments (e.g., Codespaces iframes)
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

// Only intercept console in development mode
if (import.meta.env.DEV) {
  // Store original console methods
  const originalLog = console.log;
  const originalDebug = console.debug;
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
    /tunnelClient verbose/,   // Codespaces tunnel client verbose messages
    /^ERROR%c.*Can't find variable: Notification/,  // VS Code workbench Notification API errors
    /Can't find variable: Notification/,  // Any Notification API errors
  ];

  // Helper function to check if message should be suppressed
  const shouldSuppress = (args: unknown[]): boolean => {
    // Early exit for empty or non-string args
    if (args.length === 0) return false;
    
    return args.some(arg => {
      if (typeof arg === 'string') {
        return suppressPatterns.some(pattern => pattern.test(arg));
      }
      return false;
    });
  };

  // Override console.log
  console.log = function(...args: unknown[]): void {
    if (!shouldSuppress(args)) {
      originalLog.apply(console, args);
    }
  };

  // Override console.debug
  console.debug = function(...args: unknown[]): void {
    if (!shouldSuppress(args)) {
      originalDebug.apply(console, args);
    }
  };

  // Override console.error
  console.error = function(...args: unknown[]): void {
    if (!shouldSuppress(args)) {
      originalError.apply(console, args);
    }
  };
}

export {};
