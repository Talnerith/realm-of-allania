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
import { collection, query, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';

const GameContext = createContext();

export function GameProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('user'); // 'user', 'moderator', 'admin', 'banned'
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState([]);
  const [activeCharId, setActiveCharId] = useState(null);

  // 1. Listen for Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Check Role
        const permRef = doc(db, 'artifacts', APP_ID, 'permissions', currentUser.uid);
        const permSnap = await getDoc(permRef);
        
        let role = 'user';
        if (permSnap.exists()) {
           role = permSnap.data().role || 'user';
        } else {
           // Auto-assign 'user' role if missing
           await setDoc(permRef, { role: 'user', username: currentUser.displayName });
        }

        // BAN HAMMER CHECK
        if (role === 'banned') {
            await signOut(auth);
            alert("You have been banned from the Realm of Allania.");
            setUser(null);
            setUserRole('user');
            setLoading(false);
            return;
        }

        setUserRole(role);
        setUser(currentUser);
      } else {
        setUser(null);
        setUserRole('user');
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Fetch Characters
  useEffect(() => {
    if (!user) {
      setCharacters([]);
      return;
    }

    const q = query(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'characters'));
    const unsub = onSnapshot(q, (snapshot) => {
      const chars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCharacters(chars);
    }, (error) => console.error("Error fetching characters:", error));

    return () => unsub();
  }, [user]);

  // --- Auth Actions ---

  const signup = async (email, password, username) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: username });
    await sendEmailVerification(cred.user);
    // Create default permission doc immediately
    await setDoc(doc(db, 'artifacts', APP_ID, 'permissions', cred.user.uid), {
        role: 'user',
        username: username
    });
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
      userRole,
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