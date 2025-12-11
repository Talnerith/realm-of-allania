'use client'; // Required because we use hooks like useState

import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';

const GameContext = createContext();

export function GameProvider({ children }) {
  const [user, setUser] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [activeCharId, setActiveCharId] = useState(null);
  
  // 1. Handle Login (Auto-login for now)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        signInAnonymously(auth);
      }
    });
    return () => unsub();
  }, []);

  // 2. Fetch Characters (Only when user exists)
  useEffect(() => {
    if (!user) {
      setCharacters([]);
      return;
    }

    const q = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'characters'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCharacters(chars);
      
      // We do NOT auto-select here to avoid race conditions with delete logic.
      // Selection logic is handled in components or manual user action.
      if (chars.length > 0 && !activeCharId) {
         // Optional: Safe default if nothing is selected
         // setActiveCharId(chars[0].id); 
      }
    }, (error) => {
        console.error("Error fetching characters:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // The "value" object is what other components can access
  return (
    <GameContext.Provider value={{ user, characters, activeCharId, setActiveCharId }}>
      {children}
    </GameContext.Provider>
  );
}

// Custom hook to make using this easier
export const useGame = () => useContext(GameContext);