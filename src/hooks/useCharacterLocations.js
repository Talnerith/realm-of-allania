import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  collection, query, where, limit, onSnapshot, doc, getDocs, orderBy, limitToLast,
  setDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { useGame } from '@/context/GameContext';

// How many of the character's threads the Locations panel follows
export const MAX_LOCATIONS = 8;
// Unread posts fetched per thread (the badge shows "5+" beyond this)
export const UNREAD_PEEK = 5;
// A reply within this window of the character's own post counts as theirs
const SAME_POST_MS = 5000;

const millis = (ts) => (ts?.toMillis ? ts.toMillis() : typeof ts === 'number' ? ts : 0);

// Where the active character is writing: the threads they've posted in, whose
// turn it is in each, and the unread posts by others there.
//   locations: [{ id, title, regionId, status, yourTurn, unread, lastAt }]
//   activity:  [{ id, threadId, threadTitle, by, at, excerpt }]
export default function useCharacterLocations(activeCharId) {
  const { user, readReceipts } = useGame();
  const uid = user?.uid;
  const key = uid && activeCharId ? `${uid}:${activeCharId}` : '';
  // threadId -> time of this character's latest post, for the player+character in `key`
  const [posted, setPosted] = useState({ key: '', latest: {} });
  const [threads, setThreads] = useState({}); // threadId -> thread data
  const [unread, setUnread] = useState({}); // threadId -> [posts]
  const mine = useMemo(() => (posted.key === key ? posted.latest : {}), [posted, key]);
  const loaded = posted.key === key;

  // 1. This character's posts -> the threads they write in
  useEffect(() => {
    if (!db || !key) return;
    const [uidPart, charPart] = key.split(':');
    const q = query(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'),
      where('userId', '==', uidPart),
      where('characterId', '==', charPart),
      limit(300)
    );
    return onSnapshot(q, (snap) => {
      const latest = {};
      snap.docs.forEach(d => {
        const { threadId, createdAt } = d.data();
        if (!threadId) return;
        latest[threadId] = Math.max(latest[threadId] || 0, millis(createdAt) || Date.now());
      });
      setPosted({ key, latest });
    }, () => setPosted({ key, latest: {} }));
  }, [key]);

  // Most recently written-in threads first
  const ids = useMemo(
    () => Object.entries(mine).sort((a, b) => b[1] - a[1]).slice(0, MAX_LOCATIONS).map(([id]) => id),
    [mine]
  );
  const idsKey = ids.join(',');

  // 2. Those threads, live (title, region, last reply)
  useEffect(() => {
    if (!db || !idsKey) return;
    const unsubs = idsKey.split(',').map(id => onSnapshot(
      doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', id),
      (snap) => setThreads(prev => ({ ...prev, [id]: snap.exists() ? { id, ...snap.data() } : null })),
      () => setThreads(prev => ({ ...prev, [id]: null }))
    ));
    return () => unsubs.forEach(u => u());
  }, [idsKey]);

  // 3. Unread posts by others in each thread (re-checked when it changes)
  const unreadKey = ids.filter(id => threads[id]).map(id => `${id}:${millis(threads[id]?.updatedAt)}:${readReceipts?.[id] || 0}`).join('|');
  useEffect(() => {
    if (!db || !uid || !unreadKey) return;
    let live = true;
    const postsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts');
    unreadKey.split('|').forEach(entry => {
      const [id, updated, lastRead] = entry.split(':');
      if (Number(updated) && Number(updated) <= Number(lastRead)) return; // nothing new
      getDocs(query(
        postsRef,
        where('threadId', '==', id),
        where('status', '==', 'approved'),
        where('createdAt', '>', Timestamp.fromMillis(Number(lastRead) || 0)),
        orderBy('createdAt', 'asc'),
        limitToLast(UNREAD_PEEK)
      )).then(snap => {
        if (!live) return;
        const posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.userId !== uid);
        setUnread(prev => ({ ...prev, [id]: posts }));
      }).catch(() => {});
    });
    return () => { live = false; };
  }, [unreadKey, uid]);

  // Posts fetched before the player last read the thread no longer count
  const unreadFor = useCallback((id) => {
    const lastRead = readReceipts?.[id] || 0;
    return (unread[id] || []).filter(p => millis(p.createdAt) > lastRead);
  }, [unread, readReceipts]);

  const locations = useMemo(() => ids
    .map(id => {
      const t = threads[id];
      if (!t) return null;
      const lastAt = millis(t.lastPostAt) || millis(t.updatedAt);
      const yourTurn = t.lastPostCharacterId
        ? t.lastPostCharacterId !== activeCharId
        : lastAt > (mine[id] || 0) + SAME_POST_MS;
      return {
        id, title: t.title, regionId: t.regionId, lastAt, yourTurn,
        status: yourTurn ? 'Your turn' : 'Waiting on others',
        unread: unreadFor(id).length,
        thread: t
      };
    })
    .filter(Boolean), [ids, threads, unreadFor, mine, activeCharId]);

  const activity = useMemo(() => locations
    .flatMap(l => unreadFor(l.id).map(p => ({
      id: p.id, threadId: l.id, threadTitle: l.title, thread: l.thread,
      by: p.characterName || 'Unknown', at: millis(p.createdAt), content: p.content || ''
    })))
    .sort((a, b) => b.at - a.at), [locations, unreadFor]);

  const markAllRead = useCallback(async () => {
    if (!db || !uid) return;
    const targets = locations.filter(l => l.unread > 0);
    setUnread(prev => {
      const next = { ...prev };
      targets.forEach(l => { next[l.id] = []; });
      return next;
    });
    await Promise.all(targets.map(l =>
      setDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'readReceipts', l.id), { lastRead: serverTimestamp() })
        .catch(e => console.warn('Could not mark read:', e))
    ));
  }, [locations, uid]);

  return { locations, activity, loading: !!activeCharId && !loaded, markAllRead };
}
