/**
 * Suppress debug messages from Vite HMR and Codespaces infrastructure
 * This intercepts console.log and filters out unwanted debug messages
 */

// Store original console methods
const originalLog = console.log;
const originalDebug = console.debug;

// List of patterns to suppress
const suppressPatterns = [
  /DEBUG\[vite\]/,
  /DEBUGvscs:web-client/,
  /tunnelClient verbose/,
  /connecting\.\.\./i,
  /connected\./i
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

export {};
