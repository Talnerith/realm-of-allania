import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';

// Site-wide counts for the Landing page, refreshed every 6 hours by the
// updateSiteStats Cloud Function: { members, characters, posts, regions }.
export function useSiteStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!db) return;
    let live = true;
    getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'stats', 'site'))
      .then(snap => { if (live && snap.exists()) setStats(snap.data()); })
      .catch(e => console.warn('Could not load site stats:', e));
    return () => { live = false; };
  }, []);
  return stats;
}

// 1234 -> "1,234"; large counts round down to a "+" figure (15,382 -> "15,000+")
export function formatStat(n) {
  if (typeof n !== 'number' || n < 0) return '—';
  if (n >= 10000) return `${(Math.floor(n / 1000) * 1000).toLocaleString('en-US')}+`;
  return n.toLocaleString('en-US');
}
