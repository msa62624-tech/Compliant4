import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.js',
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
    exclude: [
      'node_modules/**',
      'backend/node_modules/**',
      'backend/**/*.test.js',
      'backend/**',
      'dist/**',
      'build/**',
      'e2e/**',
      '**/*.spec.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.config.js',
        '**/**.spec.js',
        '**/**.test.js',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
