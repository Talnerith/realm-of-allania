import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { 
  MAP_IMAGE_URL, GRID_ROWS, GRID_COLS, TOTAL_REGIONS, getRegionName, isRegionPlayable, APP_ID 
} from '@/lib/constants';

export default function WorldMap({ setView, setActiveRegion }) {
  const { user, readReceipts } = useGame();
  
  const [regionLastActivity, setRegionLastActivity] = useState({});
  const [regionThreads, setRegionThreads] = useState({});
  const [customNames, setCustomNames] = useState({}); 

  // 1. Fetch Data (Guest Safe)
  useEffect(() => {
    if (!db) return; // Guard against missing env vars

    // NOTE: Removed "if (!user) return" to allow Guest/SEO fetching
    
    // A. Custom Region Names
    const unsubNames = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata'), (snap) => {
        const names = {};
        snap.docs.forEach(doc => { if (doc.data().name) names[doc.id] = doc.data().name; });
        setCustomNames(names);
    });

    // B. Thread Activity
    const q = query(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    const unsubActivity = onSnapshot(q, (snap) => {
      const activity = {};
      const mapping = {};

      snap.docs.forEach(doc => {
        const d = doc.data();
        const t = d.updatedAt?.toMillis() || 0;
        const rid = d.regionId;
        if (!activity[rid] || t > activity[rid]) activity[rid] = t;
        if (!mapping[rid]) mapping[rid] = [];
        mapping[rid].push({ id: doc.id, updatedAt: t });
      });

      setRegionLastActivity(activity);
      setRegionThreads(mapping);
    });

    return () => { unsubNames(); unsubActivity(); };
  }, []); // Empty dependency array = runs for everyone

  // 2. Memoize Region Calculations
  const regionGrid = useMemo(() => {
    return Array.from({ length: TOTAL_REGIONS }).map((_, i) => {
        const playable = isRegionPlayable(i);
        const regionName = customNames[i.toString()] || getRegionName(i);
        
        // UNREAD LOGIC (Only for Logged In Users)
        let hasUnread = false;
        if (user && readReceipts) {
            const threadsInRegion = regionThreads[i.toString()] || [];
            for (const thread of threadsInRegion) {
                const lastRead = readReceipts[thread.id] || 0;
                if (thread.updatedAt > lastRead) {
                    hasUnread = true;
                    break; 
                }
            }
        }

        if (!playable) return <div key={i} className="pointer-events-none" />;

        return (
          <div 
            key={i} 
            onClick={() => {
                const regionName = customNames[i.toString()] || getRegionName(i);
                setActiveRegion({ id: i, name: regionName });
                setView('region');
            }}
            className="relative border border-transparent hover:border-amber-400/80 hover:bg-amber-500/10 cursor-pointer transition-all duration-300 group"
          >
            {hasUnread && (
              <div className="absolute inset-0 z-0">
                <div className="absolute inset-1 border-2 border-cyan-400/80 rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.6)] animate-pulse" />
                <div className="absolute top-1 right-1 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,1)]" />
              </div>
            )}
            
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="bg-black/90 text-amber-100 text-[10px] leading-tight px-1.5 py-1 rounded border border-amber-900 font-serif whitespace-nowrap z-20 shadow-xl mx-0.5 max-w-[120px] truncate">
                {regionName} 
                {hasUnread && <span className="text-cyan-400 ml-1">●</span>}
              </span>
            </div>
          </div>
        );
      });
  }, [customNames, regionThreads, readReceipts, user, setActiveRegion, setView]);

  const handleRegionClick = (i) => {
      const regionName = customNames[i.toString()] || getRegionName(i);
      setActiveRegion({ id: i, name: regionName });
      setView('region');
  };

  return (
    <div className="relative w-full h-full overflow-auto bg-black custom-scrollbar p-4 pb-48 flex justify-start lg:justify-center">
      <div className="relative m-auto inline-block shadow-2xl shadow-black rounded-lg border border-amber-900/50 select-none shrink-0">
        <img 
            src={MAP_IMAGE_URL} 
            alt="World Map of Allania" 
            className="max-w-[1400px] w-full h-auto block min-w-[800px] bg-slate-800"
            onError={(e) => e.target.src = "https://placehold.co/1200x800/1e293b/d97706?text=Map+Not+Found"} 
        />
        <div 
          className="absolute inset-0 grid" 
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)` }}
        >
          {regionGrid}
        </div>
      </div>
    </div>
  );
}