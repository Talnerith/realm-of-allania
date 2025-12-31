module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/rules/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.rules.setup.js'],
};
