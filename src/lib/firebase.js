import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize App Check (CAPTCHA)
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
  // Debug token for localhost testing to avoid blocking dev work
  if (location.hostname === "localhost") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true; 
  }

  if (!window._firebaseAppCheck) {
     window._firebaseAppCheck = initializeAppCheck(app, {
       provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
       isTokenAutoRefreshEnabled: true 
     });
     console.log("Shields Up: App Check Active");
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);