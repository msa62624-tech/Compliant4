/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />
/// <reference types="node" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PORT?: string;
  readonly MODE: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global type declarations for enterprise-grade TypeScript
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    VITE_API_BASE_URL?: string;
    VITE_API_PORT?: string;
  }
}

// Ensure React is available globally in JSX/TSX files
declare global {
  namespace React {
    // React types are already available via @types/react
  }
}
