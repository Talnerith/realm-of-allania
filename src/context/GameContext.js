'use client';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { createProfile, ensureProfile, displayNameProblem, saveProfileName, saveProfileAvatar, profileRef } from '@/lib/profiles';

const accountRef = (uid) => doc(db, 'artifacts', APP_ID, 'users', uid, 'settings', 'account');

const NO_AVATAR = { url: '', position: 'center' };

const GameContext = createContext();

export function GameProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('user');
  // False until the signed-in player's role has arrived (userRole is 'user' until then)
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState([]);
  // The character being played and the Landing "Don't show this again"
  // choice are saved on the account, so they follow the player across devices
  const [activeCharId, setActiveCharIdState] = useState(null);
  const [hideWelcome, setHideWelcomeState] = useState(null); // null until the account loads
  // The player's author name. Kept in state because the Auth user object is
  // mutated in place by updateProfile, which wouldn't re-render anything.
  const [displayName, setDisplayNameState] = useState(null);
  // The player's author picture ({ url, position }), from their public profile
  const [avatar, setAvatar] = useState(NO_AVATAR);

  // Global Read Receipts
  const [readReceipts, setReadReceipts] = useState({});

  // 1. Listen for Auth State & Real-time Data
  useEffect(() => {
    let roleUnsub = null;
    let profileUnsub = null;
    let receiptsUnsub = null;
    let charUnsub = null;
    let presenceInterval = null;

    if (!auth) {
      // Defer state update to avoid synchronous setState in effect
      Promise.resolve().then(() => setLoading(false));
      return;
    }

    // Tear down per-user listeners before (re)subscribing, so repeated auth
    // emissions for the same user don't stack duplicate listeners/intervals
    const cleanupUserListeners = () => {
      if (roleUnsub) { roleUnsub(); roleUnsub = null; }
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }
      if (receiptsUnsub) { receiptsUnsub(); receiptsUnsub = null; }
      if (charUnsub) { charUnsub(); charUnsub = null; }
      if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
    };

    // Each auth emission gets a number; one still awaiting when a newer one
    // (or unmount) arrives must not set state or subscribe for the old user
    let authGeneration = 0;

    const authUnsub = onAuthStateChanged(auth, async (currentUser) => {
      const generation = ++authGeneration;
      cleanupUserListeners();
      setRoleLoaded(false);

      if (currentUser) {
        // The rules require a verified email in the ID token. A user who just
        // clicked the verification link still has an old token, so refresh it.
        // On page load the SDK has already reloaded the user (emailVerified is
        // true) but keeps the cached token for up to an hour, so compare the
        // token's own claim rather than the user object.
        if (!currentUser.isAnonymous) {
          try {
            if (!currentUser.emailVerified) await currentUser.reload();
            if (currentUser.emailVerified) {
              const { claims } = await currentUser.getIdTokenResult();
              if (claims.email_verified !== true) await currentUser.getIdToken(true);
            }
          } catch (e) {
            console.warn("Could not refresh verification status:", e);
          }
          if (generation !== authGeneration) return;
        }

        // Always expose the user, even if Firestore is unconfigured —
        // returning early here would leave the app on "Loading Realm..." forever
        setUser(currentUser);
        setDisplayNameState(currentUser.displayName || null);

        if (!db) {
          setLoading(false);
          return;
        }

        // --- A. User Role (Private Path) ---
        // We use the user's private settings collection to ensure they have Write access for self-healing
        const roleRef = doc(db, 'artifacts', APP_ID, 'users', currentUser.uid, 'settings', 'account');

        roleUnsub = onSnapshot(roleRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const role = data.role || 'user';
            if ('activeCharId' in data) setActiveCharIdState(data.activeCharId ?? null);
            setHideWelcomeState(data.hideWelcome === true);

            if (role === 'banned') {
              await signOut(auth);
              alert("You have been banished from the Realm of Allania.");
              setUser(null);
              setUserRole('user');
              setLoading(false);
              return;
            }
            setUserRole(role);
            setRoleLoaded(true);
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
          setRoleLoaded(true);
        });

        // Public profile (author name) for accounts made before profiles existed
        ensureProfile(currentUser);
        profileUnsub = onSnapshot(profileRef(currentUser.uid), (snap) => {
          const p = snap.exists() ? snap.data() : {};
          setAvatar(p.avatarUrl ? { url: p.avatarUrl, position: p.avatarPosition || 'center' } : NO_AVATAR);
        }, (error) => console.error("Profile listener error:", error));

        // --- B. Read Receipts ---
        {
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

          // --- D. Presence Heartbeat ---
          const updatePresence = async () => {
            try {
              const presenceRef = doc(db, 'artifacts', APP_ID, 'presence', currentUser.uid);
              await setDoc(presenceRef, {
                username: currentUser.displayName || 'Anonymous',
                lastSeen: serverTimestamp()
              });
            } catch (e) {
              console.error("Presence update failed:", e);
            }
          };

          updatePresence(); // Initial update
          presenceInterval = setInterval(updatePresence, 60000); // Update every minute
        }
      } else {
        // Cleanup on Logout (listeners already torn down above)
        setUser(null);
        setDisplayNameState(null);
        setAvatar(NO_AVATAR);
        setUserRole('user');
        setReadReceipts({});
        setCharacters([]);
        setActiveCharIdState(null);
        setHideWelcomeState(null);
      }
      setLoading(false);
    });

    return () => {
      authGeneration++;
      if (authUnsub) authUnsub();
      cleanupUserListeners();
    };
  }, []);

  // --- Auth Actions ---
  const signup = useCallback(async (email, password, username) => {
    if (!auth) throw new Error("Authentication service unavailable.");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: username });
    setDisplayNameState(username); // the auth listener fired before the name was set
    await cred.user.getIdToken(true);
    await sendEmailVerification(cred.user);

    // Create Role Entry in the PRIVATE path
    if (db) {
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', cred.user.uid, 'settings', 'account'), {
        role: 'user',
        username: username,
        email: email,
        createdAt: serverTimestamp()
      });
      // Public author name; the rules apply the same name checks as signup
      try {
        await createProfile(cred.user.uid, username);
      } catch (e) {
        console.warn("Could not create the public profile:", e);
      }
    }

    return cred.user;
  }, []);

  const login = useCallback((email, password) => {
    if (!auth) throw new Error("Authentication service unavailable.");
    return signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logout = useCallback(() => {
    setActiveCharIdState(null);
    if (!auth) return Promise.resolve();
    return signOut(auth);
  }, []);

  const resendVerification = useCallback(() => {
    if (user && auth) return sendEmailVerification(user);
  }, [user]);

  const resetPassword = useCallback((email) => {
    if (!auth) throw new Error("Authentication service unavailable.");
    return sendPasswordResetEmail(auth, email);
  }, []);

  // Saving never blocks the UI: the local state changes at once
  const saveAccountSetting = useCallback((fields) => {
    if (!user || !db) return;
    updateDoc(accountRef(user.uid), fields).catch(e => console.warn("Could not save account setting:", e));
  }, [user]);

  const setActiveCharId = useCallback((id) => {
    setActiveCharIdState(id);
    saveAccountSetting({ activeCharId: id ?? null });
  }, [saveAccountSetting]);

  const setHideWelcome = useCallback((hide) => {
    setHideWelcomeState(!!hide);
    saveAccountSetting({ hideWelcome: !!hide });
  }, [saveAccountSetting]);

  // Renames the player everywhere their name is looked up: the public
  // profile (codex "Written by"), the Auth profile (navbar, presence) and the
  // private account doc. Throws with a user-facing message.
  const updateDisplayName = useCallback(async (name) => {
    const next = typeof name === 'string' ? name.trim() : '';
    const problem = displayNameProblem(next, { allowReserved: userRole === 'admin' || userRole === 'moderator' });
    if (problem) throw new Error(problem);
    if (!auth?.currentUser || !db) throw new Error('You must be signed in.');
    try {
      await saveProfileName(auth.currentUser.uid, next);
      await updateProfile(auth.currentUser, { displayName: next });
    } catch (e) {
      console.error('Could not change the display name:', e);
      throw new Error('Could not save your name. Please try again.');
    }
    setDisplayNameState(next);
    saveAccountSetting({ username: next });
  }, [userRole, saveAccountSetting]);

  // Sets ('' removes) the author picture. Throws with a user-facing message.
  const updateAvatar = useCallback(async (url, position = 'center') => {
    if (!auth?.currentUser || !db) throw new Error('You must be signed in.');
    try {
      await saveProfileAvatar(auth.currentUser.uid, url || '', position);
    } catch (e) {
      console.error('Could not change the author picture:', e);
      throw new Error('Could not save your picture. Please try again.');
    }
    setAvatar(url ? { url, position } : NO_AVATAR);
  }, []);

  // OPTIMIZATION: Memoize context value to prevent unnecessary re-renders of consuming components
  // when GameProvider renders but data hasn't changed.
  const value = useMemo(() => ({
    user, userRole, roleLoaded, loading, characters, activeCharId, setActiveCharId,
    hideWelcome, setHideWelcome,
    displayName, updateDisplayName, avatar, updateAvatar,
    readReceipts,
    signup, login, logout, resendVerification, resetPassword
  }), [
    user, userRole, roleLoaded, loading, characters, activeCharId, setActiveCharId,
    hideWelcome, setHideWelcome,
    displayName, updateDisplayName, avatar, updateAvatar,
    readReceipts,
    signup, login, logout, resendVerification, resetPassword
  ]);

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);