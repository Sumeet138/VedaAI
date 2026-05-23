/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '@vedaai/shared': '<rootDir>/../../shared/src/index.ts',
  },
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
  testTimeout: 60000,
  forceExit: true,
  clearMocks: true,
  coverageDirectory: '../coverage',
  collectCoverageFrom: ['**/*.ts', '!**/__tests__/**', '!**/index.ts'],
};
