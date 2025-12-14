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
  const [userRole, setUserRole] = useState('user'); 
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState([]);
  const [activeCharId, setActiveCharId] = useState(null);
  
  // NEW: Global Read Receipts (Thread Level)
  const [readReceipts, setReadReceipts] = useState({});

  // 1. Listen for Auth State & Real-time Permissions
  useEffect(() => {
    let permUnsub = null;
    let receiptsUnsub = null;

    const authUnsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Permissions
        const permRef = doc(db, 'artifacts', APP_ID, 'permissions', currentUser.uid);
        permUnsub = onSnapshot(permRef, async (snapshot) => {
            let role = 'user';
            if (snapshot.exists()) role = snapshot.data().role || 'user';
            else await setDoc(permRef, { role: 'user', username: currentUser.displayName });

            if (role === 'banned') {
                await signOut(auth);
                alert("You have been banished from the Realm of Allania.");
                setUser(null);
                setUserRole('user');
                setLoading(false);
                return;
            }
            setUserRole(role);
        });

        // NEW: Real-time Thread Read Receipts
        // We listen to the user's private read receipts to update UI instantly
        const receiptsRef = collection(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'readReceipts');
        receiptsUnsub = onSnapshot(receiptsRef, (snapshot) => {
            const receipts = {};
            snapshot.docs.forEach(doc => {
                receipts[doc.id] = doc.data().lastRead?.toMillis() || 0;
            });
            setReadReceipts(receipts);
        });

        setUser(currentUser);
      } else {
        setUser(null);
        setUserRole('user');
        setReadReceipts({});
        if (permUnsub) permUnsub();
        if (receiptsUnsub) receiptsUnsub();
      }
      setLoading(false);
    });

    return () => {
        authUnsub();
        if (permUnsub) permUnsub();
        if (receiptsUnsub) receiptsUnsub();
    };
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
    await setDoc(doc(db, 'artifacts', APP_ID, 'permissions', cred.user.uid), {
        role: 'user',
        username: username
    });
    return cred.user;
  };

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => { setActiveCharId(null); return signOut(auth); };
  const resendVerification = () => { if (user) return sendEmailVerification(user); };

  return (
    <GameContext.Provider value={{ 
      user, userRole, loading, characters, activeCharId, setActiveCharId,
      readReceipts, // Exported to app
      signup, login, logout, resendVerification
    }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);