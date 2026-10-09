module.exports = {
  testEnvironment: 'node',
  // All suites share one emulator and clearFirestore() in beforeEach —
  // parallel workers race each other's data. Run serially.
  maxWorkers: 1,
  // Rules tests live at the repo root as firestore.rules.*.test.js
  // (plus the emulator-backed moderation rules test under src/)
  testMatch: [
    '**/__tests__/rules/**/*.test.js',
    '<rootDir>/firestore.rules.*.test.js',
    '<rootDir>/storage.rules.test.js',
    '<rootDir>/src/lib/moderation/moderation.test.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.rules.setup.js'],
};
