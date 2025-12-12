import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAi3lsOJ6ReOFYLvL_YoPpOVsubJcrCAKM",
  authDomain: "realm-of-aethelraed.firebaseapp.com",
  projectId: "realm-of-aethelraed",
  storageBucket: "realm-of-aethelraed.firebasestorage.app",
  messagingSenderId: "1050764167568",
  appId: "1:1050764167568:web:a5a693e13a308f77598b15",
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);