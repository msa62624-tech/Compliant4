export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'server.js',
    'services/**/*.js',
    'utils/**/*.js',
    '!**/__tests__/**',
  ],
  testTimeout: 30000,
};
