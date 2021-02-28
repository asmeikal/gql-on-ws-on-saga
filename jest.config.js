module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/*.test.ts'],
  collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/builders/.*',
    '<rootDir>/src/structures/.*',
    '<rootDir>/src/types/.*',
    '<rootDir>/src/transport/getWebSocketImpl.ts',
    '<rootDir>/src/utils/serialization.ts',
    '<rootDir>/src/utils/validation.ts',
  ],
  setupFilesAfterEnv: ['jest-extended'],
};
