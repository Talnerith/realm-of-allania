import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { 
  MAP_IMAGE_URL, 
  GRID_ROWS, 
  GRID_COLS, 
  TOTAL_REGIONS, 
  getRegionName, 
  isRegionPlayable, 
  APP_ID 
} from '@/lib/constants';

export default function WorldMap({ setView, setActiveRegion }) {
  const { user } = useGame();
  const [regionLastActivity, setRegionLastActivity] = useState({});
  const [userReadHistory, setUserReadHistory] = useState({});
  const [customNames, setCustomNames] = useState({}); // New State for DB names

  // 1. Fetch Data
  useEffect(() => {
    if (!user) return;

    // A. Listen for Custom Region Names
    const unsubNames = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata'), (snap) => {
        const names = {};
        snap.docs.forEach(doc => {
            if (doc.data().name) {
                names[doc.id] = doc.data().name;
            }
        });
        setCustomNames(names);
    });

    // B. Listen for Thread Activity
    const unsubActivity = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'), (snap) => {
      const activity = {};
      snap.docs.forEach(doc => {
        const d = doc.data();
        const t = d.updatedAt?.toMillis() || 0;
        if (!activity[d.regionId] || t > activity[d.regionId]) {
            activity[d.regionId] = t;
        }
      });
      setRegionLastActivity(activity);
    });

    // C. Listen for Read History
    const unsubRead = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts'), (snap) => {
      const history = {};
      snap.docs.forEach(doc => history[doc.id] = doc.data().lastRead?.toMillis() || 0);
      setUserReadHistory(history);
    });

    return () => {
        unsubNames();
        unsubActivity();
        unsubRead();
    };
  }, [user]);

  // 2. Handle Click
  const handleRegionClick = async (i) => {
      // Prefer custom name, fallback to default
      const regionName = customNames[i.toString()] || getRegionName(i);
      
      setActiveRegion({ id: i, name: regionName });
      setView('region');

      if (user) {
          await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', i.toString()), { 
              lastRead: serverTimestamp() 
          }, { merge: true });
      }
  };

  return (
    <div className="relative w-full h-full overflow-auto bg-black custom-scrollbar p-4 pb-48 flex justify-start lg:justify-center">
      <div className="relative m-auto inline-block shadow-2xl shadow-black rounded-lg border border-amber-900/50 select-none shrink-0">
        <img 
            src={MAP_IMAGE_URL} 
            alt="World Map" 
            className="max-w-[1400px] w-full h-auto block min-w-[800px] bg-slate-800"
        />
        <div 
          className="absolute inset-0 grid" 
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)` }}
        >
          {Array.from({ length: TOTAL_REGIONS }).map((_, i) => {
            const playable = isRegionPlayable(i);
            
            // Dynamic Name Logic
            const regionName = customNames[i.toString()] || getRegionName(i);
            
            const lastActivity = regionLastActivity[i.toString()] || 0;
            const lastRead = userReadHistory[i.toString()] || 0;
            const isUnread = lastActivity > lastRead;

            if (!playable) return <div key={i} className="pointer-events-none" />;

            return (
              <div 
                key={i} 
                onClick={() => handleRegionClick(i)} 
                className="relative border border-transparent hover:border-amber-400/80 hover:bg-amber-500/10 cursor-pointer transition-all duration-300 group"
              >
                {isUnread && (
                  <div className="absolute inset-0 z-0">
                    <div className="absolute inset-1 border-2 border-cyan-400/80 rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.6)] animate-pulse" />
                    <div className="absolute top-1 right-1 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,1)]" />
                  </div>
                )}
                
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="bg-black/90 text-amber-100 text-[10px] leading-tight px-1.5 py-1 rounded border border-amber-900 font-serif whitespace-nowrap z-20 shadow-xl mx-0.5 max-w-[120px] truncate">
                    {regionName} 
                    {isUnread && <span className="text-cyan-400 ml-1">●</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}