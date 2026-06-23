import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// We check if the variables exist to prevent silent crashes
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Safety Check - Suppressed for dev/test without env vars
if (!firebaseConfig.projectId && typeof window !== 'undefined') {
  console.warn("Firebase Environment Variables are missing. App will run in limited mode.");
}

const app = getApps().length === 0 && firebaseConfig.apiKey ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize App Check (CAPTCHA)
// Temporarily disabled for local development to avoid console errors
// Re-enable for production builds
if (app && typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && location.hostname !== "localhost") {
  if (!window._firebaseAppCheck) {
    try {
      window._firebaseAppCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    } catch (e) {
      console.warn("Firebase App Check failed to initialize (likely due to adblocker or network issue). App will continue in limited mode.", e);
    }
  }
}

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
