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

// Safety Check
if (!firebaseConfig.projectId && typeof window !== 'undefined') {
    console.error("CRITICAL: Firebase Environment Variables are missing. Check Vercel Settings.");
}

let app;
let auth;
let db;
let storage;

try {
  if (getApps().length === 0) {
    if (firebaseConfig.apiKey) {
      app = initializeApp(firebaseConfig);
    } else {
      console.warn("Firebase API Key missing. Skipping initialization.");
    }
  } else {
    app = getApps()[0];
  }

  if (app) {
    // Initialize App Check (CAPTCHA)
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      if (location.hostname === "localhost") {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      if (!window._firebaseAppCheck) {
         window._firebaseAppCheck = initializeAppCheck(app, {
           provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
           isTokenAutoRefreshEnabled: true
         });
      }
    }

    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
} catch (e) {
  console.error("Firebase Initialization Failed:", e);
}

export { auth, db, storage };