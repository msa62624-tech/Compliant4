/**
 * Suppress debug messages from Vite HMR and Codespaces infrastructure
 * This intercepts console.log and filters out unwanted debug messages
 * Only runs in development mode to avoid interfering with production monitoring
 */

// Only intercept console in development mode
if (import.meta.env.DEV) {
  // Store original console methods
  const originalLog = console.log;
  const originalDebug = console.debug;

  // List of specific patterns to suppress from Vite HMR and Codespaces
  const suppressPatterns = [
    /^\[vite\].*DEBUG/,  // Vite debug messages starting with [vite] DEBUG
    /^DEBUG\[vite\]/,    // DEBUG[vite] messages
    /^DEBUGvscs:web-client/,  // Codespaces web client debug
    /tunnelClient verbose/,   // Codespaces tunnel client verbose messages
  ];

  // Helper function to check if message should be suppressed
  const shouldSuppress = (args: unknown[]): boolean => {
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
}

export {};
