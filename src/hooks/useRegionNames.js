import { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID, getRegionName, unnamedRegionLabel } from '@/lib/constants';

// Custom region names (region_metadata), live. Returns a lookup function:
// regionName(id) -> "Thornwatch Ridge" or "Lands Yet Unwritten".
export default function useRegionNames() {
  const [names, setNames] = useState({});

  useEffect(() => {
    if (!db) return;
    return onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata'), (snap) => {
      const next = {};
      snap.docs.forEach(d => { if (d.data().name) next[d.id] = d.data().name; });
      setNames(next);
    }, () => {});
  }, []);

  return useCallback(
    (id) => (id === undefined || id === null ? '' : names[String(id)] || getRegionName(Number(id)) || unnamedRegionLabel(id)),
    [names]
  );
}
