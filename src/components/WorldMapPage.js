import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin } from 'lucide-react';
import WorldMap, { THREAD_FRAME, THREAD_DOT } from '@/components/WorldMap';
import SiteFooter from '@/components/SiteFooter';
import { Gem } from '@/components/Ornaments';

// Below this frame width the map stops shrinking and scrolls sideways
const MIN_MAP_WIDTH = 820;

function MapLegend() {
    return (
        <ul aria-label="Map legend" className="flex flex-col gap-3 rounded-lg border border-gold-900/50 bg-ink-900 px-4 py-3">
            <li className="flex items-center gap-3">
                <span aria-hidden="true" className={`relative shrink-0 w-7 h-5 rounded-sm ${THREAD_FRAME}`}>
                    <span className={`absolute left-[3px] bottom-[3px] w-1.5 h-1.5 rounded-full ${THREAD_DOT}`} />
                </span>
                <span className="text-sm text-ink-200">Region with active threads</span>
            </li>
            <li className="flex items-center gap-3">
                <span aria-hidden="true" className="relative shrink-0 w-7 h-5 rounded-sm border-2 border-cyan-400 animate-pulse shadow-[0_0_10px_rgb(34_211_238/.6)]">
                    <span className="absolute right-0.5 top-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                </span>
                <span className="text-sm text-ink-200">Posts you haven&apos;t read</span>
            </li>
            <li className="text-xs text-ink-400 pl-10">Hover a region for its name and thread count.</li>
        </ul>
    );
}

// Live name of the region under the pointer
function RegionReadout({ region, scrollMode }) {
    return (
        <div aria-live="polite" className="flex items-center justify-between gap-4 rounded-lg border border-gold-900/50 bg-ink-900 px-4 md:px-6 py-3 min-h-[4.75rem] -mt-1">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <MapPin className="w-[26px] h-[26px] shrink-0 text-gold-500" strokeWidth={1.6} aria-hidden="true" />
                <div className="flex flex-col min-w-0">
                    <span className="text-xs uppercase tracking-widest text-gold-500">Region</span>
                    {region ? (
                        <span className="font-serif font-bold text-gold-100 text-2xl md:text-4xl leading-tight truncate">{region.name}</span>
                    ) : (
                        <span className="font-serif italic text-ink-400 text-xl md:text-2xl leading-tight truncate">
                            {scrollMode ? 'Tap a region on the map' : 'Hover over a region on the map'}
                        </span>
                    )}
                </div>
            </div>
            {region?.hasUnread ? (
                <span className="shrink-0 flex items-center gap-2 rounded-full border border-cyan-400 text-cyan-400 text-sm font-medium px-3 py-1">
                    <span className="w-[7px] h-[7px] rounded-full bg-cyan-400" aria-hidden="true" />
                    Unread posts
                </span>
            ) : region?.threadCount > 0 ? (
                <span className="shrink-0 rounded-full border border-gold-700 bg-gold-900/30 text-gold-300 text-sm font-medium px-3 py-1">
                    {region.threadCount} active thread{region.threadCount === 1 ? '' : 's'}
                </span>
            ) : null}
        </div>
    );
}

// The main page after sign-in: title + legend, the framed WorldMap, the
// region readout and the site footer. Scrolls as one page under the navbar.
export default function WorldMapPage({ setView, setActiveRegion, onOpenLegal }) {
    const [hoverRegion, setHoverRegion] = useState(null);
    const [scrollMode, setScrollMode] = useState(false);
    const frameRef = useRef(null);

    useEffect(() => {
        const el = frameRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => setScrollMode(el.clientWidth < MIN_MAP_WIDTH));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const handleRegionHover = useCallback((region) => setHoverRegion(region), []);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-ink-950">
            <section className="w-full max-w-7xl mx-auto px-3 md:px-8 pt-8 md:pt-12 pb-12 md:pb-16 flex flex-col gap-6 md:gap-8">
                <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
                    <div className="flex flex-col gap-2 min-w-0">
                        <span className="text-xs uppercase tracking-widest text-gold-500">World Map</span>
                        <h1 className="font-serif font-bold text-gold-100 leading-none text-[clamp(2.25rem,1.4rem+3vw,4rem)] text-balance">The Realm of Allania</h1>
                        <p className="mt-1 text-ink-300 text-base md:text-lg text-pretty">Choose a region to read its threads and join the story.</p>
                    </div>
                    <MapLegend />
                </div>

                {/* Gold frame: gems on the corners and the top/bottom centres */}
                <div className="relative bg-ink-950 border border-gold-600 shadow-2xl p-[5px]">
                    <Gem size={20} style={{ left: -10, top: -10 }} />
                    <Gem size={20} style={{ right: -10, top: -10 }} />
                    <Gem size={20} style={{ left: -10, bottom: -10 }} />
                    <Gem size={20} style={{ right: -10, bottom: -10 }} />
                    <Gem size={24} style={{ left: 'calc(50% - 12px)', top: -12 }} />
                    <Gem size={24} style={{ left: 'calc(50% - 12px)', bottom: -12 }} />
                    <div ref={frameRef} className="border border-gold-900 bg-ink-900 overflow-x-auto overflow-y-hidden custom-scrollbar">
                        <div className="min-w-[820px]">
                            <WorldMap setView={setView} setActiveRegion={setActiveRegion} onRegionHover={handleRegionHover} />
                        </div>
                    </div>
                </div>

                <RegionReadout region={hoverRegion} scrollMode={scrollMode} />
                {scrollMode && (
                    <p className="-mt-3 text-xs text-ink-400 text-center">Swipe sideways to see the whole map.</p>
                )}
            </section>

            <SiteFooter onOpenLegal={onOpenLegal} />
            {/* Keeps the fixed Character Roster bar off the footer */}
            <div className="h-16 shrink-0 bg-[rgb(1_12_28)]" aria-hidden="true" />
        </div>
    );
}
