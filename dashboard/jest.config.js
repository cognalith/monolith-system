/**
 * Jest configuration for dashboard package
 * Configured for ES Modules support with Express API testing
 */

export default {
  // Use ES modules
  testEnvironment: 'node',

  // Transform settings for ES modules
  transform: {},

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'node'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/components/**',
    '!src/main.jsx',
    '!**/node_modules/**'
  ],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Setup files to run before tests
  setupFilesAfterEnv: [],

  // Test timeout (increased for integration tests)
  testTimeout: 10000
};
