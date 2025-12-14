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
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';

const GameContext = createContext();

export function GameProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('user'); 
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState([]);
  const [activeCharId, setActiveCharId] = useState(null);
  
  // Global Read Receipts
  const [readReceipts, setReadReceipts] = useState({});

  // 1. Listen for Auth State & Real-time Data
  useEffect(() => {
    let roleUnsub = null;
    let receiptsUnsub = null;
    let charUnsub = null;

    const authUnsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // --- A. User Role (Private Path) ---
        // We use the user's private settings collection to ensure they have Write access for self-healing
        const roleRef = doc(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'settings', 'account');
        
        roleUnsub = onSnapshot(roleRef, async (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const role = data.role || 'user';
                
                if (role === 'banned') {
                    await signOut(auth);
                    alert("You have been banished from the Realm of Allania.");
                    setUser(null);
                    setUserRole('user');
                    setLoading(false);
                    return;
                }
                setUserRole(role);
            } else {
                // Auto-Heal: If the document is missing, create it in the safe private path
                console.log("Initializing user account settings...");
                try {
                    await setDoc(roleRef, { 
                        role: 'user', 
                        username: currentUser.displayName || 'Anonymous',
                        email: currentUser.email || 'No Email',
                        createdAt: serverTimestamp()
                    });
                } catch (e) {
                    console.error("Auto-heal failed:", e);
                }
            }
        }, (error) => {
            console.error("Role listener error:", error);
            // Fallback to 'user' if permission fails, prevents crash
            setUserRole('user'); 
        });

        // --- B. Read Receipts ---
        const receiptsRef = collection(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'readReceipts');
        receiptsUnsub = onSnapshot(receiptsRef, (snapshot) => {
            const receipts = {};
            snapshot.docs.forEach(doc => {
                receipts[doc.id] = doc.data().lastRead?.toMillis() || 0;
            });
            setReadReceipts(receipts);
        }, (error) => console.error("Receipts error:", error));

        // --- C. Characters (Moved inside Auth to guarantee user exists) ---
        const charQ = query(collection(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'characters'));
        charUnsub = onSnapshot(charQ, (snapshot) => {
            const chars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCharacters(chars);
        }, (error) => console.error("Characters error:", error));

        setUser(currentUser);
      } else {
        // Cleanup on Logout
        setUser(null);
        setUserRole('user');
        setReadReceipts({});
        setCharacters([]);
        if (roleUnsub) roleUnsub();
        if (receiptsUnsub) receiptsUnsub();
        if (charUnsub) charUnsub();
      }
      setLoading(false);
    });

    return () => {
        authUnsub();
        if (roleUnsub) roleUnsub();
        if (receiptsUnsub) receiptsUnsub();
        if (charUnsub) charUnsub();
    };
  }, []);

  // --- Auth Actions ---
  const signup = async (email, password, username) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: username });
    await sendEmailVerification(cred.user);
    
    // Create Role Entry in the PRIVATE path
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', cred.user.uid, 'settings', 'account'), {
        role: 'user',
        username: username,
        email: email,
        createdAt: serverTimestamp()
    });
    
    return cred.user;
  };

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => { setActiveCharId(null); return signOut(auth); };
  const resendVerification = () => { if (user) return sendEmailVerification(user); };

  return (
    <GameContext.Provider value={{ 
      user, userRole, loading, characters, activeCharId, setActiveCharId,
      readReceipts,
      signup, login, logout, resendVerification
    }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);