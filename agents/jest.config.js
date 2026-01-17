/**
 * Jest configuration for agents package
 * Configured for ES Modules support
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
    '/node_modules/'
  ],

  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'node'],

  // Coverage configuration
  collectCoverageFrom: [
    'core/**/*.js',
    'services/**/*.js',
    'neural-stack/**/*.js',
    '!neural-stack/**/*.test.js',
    '!**/node_modules/**'
  ],

  // Coverage thresholds (can be adjusted)
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true
};
