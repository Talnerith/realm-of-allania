import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import {
  MAP_IMAGE_URL, MAP_WIDTH, MAP_HEIGHT, GRID_ROWS, GRID_COLS, TOTAL_REGIONS, getRegionName, isRegionPlayable, APP_ID,
  unnamedRegionLabel
} from '@/lib/constants';

// Re-exported for existing imports
export { unnamedRegionLabel };

// Active-thread marker, shared with the WorldMapPage legend. At 75% so a map
// with many active regions doesn't clutter; unread (cyan) stays at full.
export const THREAD_OPACITY = 'opacity-75';
export const THREAD_FRAME = 'border-2 border-(color:--a-300) bg-[color-mix(in_oklab,var(--a-400)_22%,transparent)] shadow-[0_0_0_1.5px_rgb(20_12_3/.85),inset_0_0_0_1.5px_rgb(20_12_3/.85),0_0_14px_2px_color-mix(in_oklab,var(--a-500)_75%,transparent)]';
export const THREAD_DOT = 'bg-(color:--a-300) shadow-[0_0_0_1.5px_rgb(20_12_3/.9),0_0_6px_var(--a-400)]';

// The painted map plus its 20x13 click grid. It fills its parent's width at
// the map's fixed 2816x1504 aspect, so the parent decides size and scrolling.
function WorldMap({ setActiveRegion, onRegionHover }) {
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

    // B. Thread Activity (approved only — rules deny reading unapproved threads)
    const q = query(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'),
      where('status', '==', 'approved'),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    const unsubActivity = onSnapshot(q, (snap) => {
      const activity = {};
      const mapping = {};

      snap.docs.forEach(doc => {
        const d = doc.data();
        // Only approved (or legacy) threads count toward public map activity
        if (d.status && d.status !== 'approved') return;
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

  const handleRegionClick = useCallback((i) => {
    const regionName = customNames[i.toString()] || getRegionName(i) || unnamedRegionLabel(i);
    // Also navigates (one history entry, carrying the region id)
    setActiveRegion({ id: i, name: regionName });
  }, [customNames, setActiveRegion]);

  // 2. Memoize Region Calculations
  const regionGrid = useMemo(() => {
    return Array.from({ length: TOTAL_REGIONS }).map((_, i) => {
      const playable = isRegionPlayable(i);
      const regionName = customNames[i.toString()] || getRegionName(i);

      // Check if region has any threads
      const threadsInRegion = regionThreads[i.toString()] || [];
      const hasThreads = threadsInRegion.length > 0;
      const threadCount = threadsInRegion.length;

      // UNREAD LOGIC (Only for Logged In Users)
      let hasUnread = false;
      if (user && readReceipts) {
        for (const thread of threadsInRegion) {
          const lastRead = readReceipts[thread.id] || 0;
          if (thread.updatedAt > lastRead) {
            hasUnread = true;
            break;
          }
        }
      }

      if (!playable) return <div key={i} className="pointer-events-none" />;

      const label = regionName || unnamedRegionLabel(i);
      const hover = onRegionHover ? () => onRegionHover({ id: i, name: label, threadCount, hasUnread }) : undefined;

      return (
        <button
          type="button"
          key={i}
          onClick={() => handleRegionClick(i)}
          onMouseEnter={hover}
          onFocus={hover}
          aria-label={`${label}${hasUnread ? ', unread posts' : hasThreads ? `, ${threadCount} active thread${threadCount === 1 ? '' : 's'}` : ''}`}
          className={`relative border cursor-pointer transition-all duration-300 group focus:outline-none focus-visible:border-gold-300 ${
            hasUnread
              ? 'border-transparent'
              : hasThreads
                ? 'border-transparent'
                : 'border-transparent hover:border-gold-400/80 hover:bg-gold-500/10'
          }`}
        >
          {/* Region with threads: a bright gold frame, outlined dark so it reads
              on the painted parchment (fixed --a-* colours: the map looks the
              same in every theme). Only when no unread. */}
          {hasThreads && !hasUnread && (
            <span className={`absolute inset-0 z-0 pointer-events-none ${THREAD_OPACITY}`}>
              <span className={`absolute inset-1 rounded-sm ${THREAD_FRAME}`} />
              <span className={`absolute bottom-1 left-1 w-2 h-2 rounded-full ${THREAD_DOT}`} />
            </span>
          )}

          {/* Unread notification (cyan glow - takes priority over threads indicator) */}
          {hasUnread && (
            <span className="absolute inset-0 z-0 pointer-events-none">
              <span className="absolute inset-1 border-2 border-cyan-400/80 rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.6)] animate-pulse" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,1)]" />
            </span>
          )}

          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none" aria-hidden="true">
            <span className="bg-black/90 text-(color:--a-100) text-xs font-semibold leading-tight px-1.5 py-1 rounded border border-(color:--a-900) font-serif whitespace-nowrap z-20 shadow-xl mx-0.5 max-w-[140px] truncate">
              {label}
              {hasThreads && !hasUnread && <span className="text-(color:--a-400) ml-1">({threadCount})</span>}
              {hasUnread && <span className="text-cyan-400 ml-1">●</span>}
            </span>
          </span>
        </button>
      );
    });
  }, [customNames, regionThreads, readReceipts, user, handleRegionClick, onRegionHover]);

  return (
    <div
      className="relative w-full select-none bg-ink-900"
      style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}
      onMouseLeave={onRegionHover ? () => onRegionHover(null) : undefined}
    >
      <img
        src={MAP_IMAGE_URL}
        alt="World Map of Allania"
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        className="absolute inset-0 w-full h-full block"
        draggable={false}
        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
      />
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)` }}
      >
        {regionGrid}
      </div>
    </div>
  );
}

export default memo(WorldMap);