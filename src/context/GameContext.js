'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';

const GameContext = createContext();

export function GameProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState([]);
  const [activeCharId, setActiveCharId] = useState(null);

  // 1. Listen for Auth State Changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Fetch Characters (Only if logged in)
  useEffect(() => {
    if (!user) {
      setCharacters([]);
      return;
    }

    const q = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'characters'));
    const unsub = onSnapshot(q, (snapshot) => {
      const chars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCharacters(chars);
      
      // Auto-select logic (safe)
      if (chars.length > 0 && !activeCharId) {
         // Optionally set active char here, or let user choose
      }
    });

    return () => unsub();
  }, [user, activeCharId]);

  // --- Auth Actions ---

  const signup = async (email, password, username) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Add display name
    await updateProfile(cred.user, { displayName: username });
    // Send verification email
    await sendEmailVerification(cred.user);
    return cred.user;
  };

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    setActiveCharId(null);
    return signOut(auth);
  };

  const resendVerification = () => {
    if (user) return sendEmailVerification(user);
  };

  return (
    <GameContext.Provider value={{ 
      user, 
      loading,
      characters, 
      activeCharId, 
      setActiveCharId,
      signup,
      login,
      logout,
      resendVerification
    }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);