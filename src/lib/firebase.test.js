jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'app' })),
  getApps: jest.fn(() => []),
}));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(() => ({})) }));
jest.mock('firebase/firestore', () => ({ getFirestore: jest.fn(() => ({})) }));
jest.mock('firebase/storage', () => ({ getStorage: jest.fn(() => ({})) }));
jest.mock('firebase/functions', () => ({ getFunctions: jest.fn(() => ({})) }));
jest.mock('firebase/app-check', () => ({
  initializeAppCheck: jest.fn(() => ({ appCheck: true })),
  ReCaptchaV3Provider: jest.fn(),
}));

const ORIGINAL_ENV = process.env;

// jsdom serves the tests from http://localhost, so this exercises local dev.
const loadOnLocalhost = (env) => {
  process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_FIREBASE_API_KEY: 'key', NEXT_PUBLIC_RECAPTCHA_SITE_KEY: 'site', ...env };
  let appCheck;
  jest.isolateModules(() => {
    appCheck = require('firebase/app-check');
    require('./firebase');
  });
  return appCheck;
};

describe('App Check on localhost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window._firebaseAppCheck;
    delete self.FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('uses the debug token from the environment', () => {
    const { initializeAppCheck } = loadOnLocalhost({ NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN: 'debug-uuid' });

    expect(self.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe('debug-uuid');
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);
  });

  it('skips App Check without a debug token', () => {
    const { initializeAppCheck } = loadOnLocalhost({ NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN: '' });

    expect(self.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
    expect(initializeAppCheck).not.toHaveBeenCalled();
  });
});
