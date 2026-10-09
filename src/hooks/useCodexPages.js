import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { useGame } from '@/context/GameContext';

// All codex pages this player may see, sorted by title, live.
// Security rules deny reading unapproved pages, so non-mods run a
// status-filtered query plus (when signed in) an own-pages query, merged by
// id. Mods query everything.
export default function useCodexPages() {
  const { user, userRole } = useGame();
  const isAdminOrMod = userRole === 'admin' || userRole === 'moderator';
  const [state, setState] = useState({ pages: [], loading: true, error: null });

  useEffect(() => {
    if (!db) {
      // Deferred so the effect doesn't set state synchronously
      Promise.resolve().then(() => setState({ pages: [], loading: false, error: 'Codex unavailable.' }));
      return;
    }
    const pagesRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages');
    const results = { approved: [], mine: [] };
    const publish = () => {
      const byId = new Map();
      [...results.approved, ...results.mine].forEach(p => byId.set(p.id, p));
      const pages = Array.from(byId.values()).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      setState({ pages, loading: false, error: null });
    };
    const onError = (err) => {
      console.error('Codex Error:', err);
      setState(prev => ({ ...prev, loading: false, error: 'Failed to load Codex entries.' }));
    };

    const unsubs = [];
    if (isAdminOrMod) {
      unsubs.push(onSnapshot(query(pagesRef, orderBy('title', 'asc'), limit(500)), (snap) => {
        results.approved = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        publish();
      }, onError));
    } else {
      unsubs.push(onSnapshot(query(pagesRef, where('status', '==', 'approved'), orderBy('title', 'asc'), limit(500)), (snap) => {
        results.approved = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        publish();
      }, onError));
      if (user) {
        unsubs.push(onSnapshot(query(pagesRef, where('creatorId', '==', user.uid), orderBy('title', 'asc'), limit(500)), (snap) => {
          results.mine = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          publish();
        }, onError));
      }
    }
    return () => unsubs.forEach(u => u());
  }, [isAdminOrMod, user]);

  return state;
}
