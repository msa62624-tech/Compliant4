/// <reference types="react" />
/// <reference types="node" />

/**
 * Global type declarations for enterprise-grade TypeScript
 * Ensures all commonly used types are properly defined
 */

// Make RequestInit available globally for fetch operations
declare global {
  // RequestInit is already available from lib.dom.d.ts in TypeScript
  // This ensures it's recognized in all contexts
  type FetchRequestInit = RequestInit;
}

export {};
