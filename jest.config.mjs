import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: './',
})

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const config = {
    // Add more setup options before each test is run
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },

    testEnvironment: 'jest-environment-jsdom',

    // Emulator-dependent suites (security rules + functions) run separately:
    //   npx firebase emulators:exec --only firestore "npx jest --config jest.rules.config.js"
    //   cd functions && npm test
    testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/functions/',
        '<rootDir>/firestore\\.rules\\..*\\.test\\.js',
        '<rootDir>/src/lib/moderation/moderation\\.test\\.js',
    ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
