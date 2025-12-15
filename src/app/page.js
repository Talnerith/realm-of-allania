'use client';
import { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID, getRegionName } from '@/lib/constants';
import { GameProvider, useGame } from '@/context/GameContext';

import Navbar from '@/components/Navbar';
import WorldMap from '@/components/WorldMap';
import CharacterDrawer from '@/components/CharacterDrawer';
import RegionView from '@/components/Forum/RegionView';
import ThreadView from '@/components/Forum/ThreadView';
import CodexIndex from '@/components/Codex/CodexIndex';
import CodexEntry from '@/components/Codex/CodexEntry';
import SearchResults from '@/components/Codex/SearchResults';
import AuthScreen from '@/components/AuthScreen';
import { Loader } from 'lucide-react';

export default function Home() {
  return (
    <GameProvider>
       <GameContainer />
    </GameProvider>
  );
}

function GameContainer() {
  const { user, loading } = useGame();
  
  // Navigation State
  const [view, setView] = useState('map'); 
  const [activeRegion, setActiveRegion] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [activeCodexPage, setActiveCodexPage] = useState(null);

  // Search State
  const [codexPages, setCodexPages] = useState([]);
  const [searchResults, setSearchResults] = useState({ pages: [], posts: [] });
  const [isSearching, setIsSearching] = useState(false);

  // History State Tracker
  const isPopping = useRef(false);

  // --- Reset View on Logout ---
  useEffect(() => {
    if (!user) {
        setView('map');
    }
  }, [user]);

  // --- 1. INITIAL LOAD (DEEP LINKING) ---
  useEffect(() => {
      // Logic to restore state from URL Query Params on fresh load
      const initFromUrl = async () => {
          if (typeof window === 'undefined') return;

          const params = new URLSearchParams(window.location.search);
          const threadId = params.get('thread');
          const regionId = params.get('region');
          const pageParam = params.get('page');

          if (threadId) {
             try {
                // Fetch Thread Data
                const threadRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', threadId);
                const threadSnap = await getDoc(threadRef);
                if (threadSnap.exists()) {
                    const tData = { id: threadSnap.id, ...threadSnap.data() };
                    // We also need the Region data for the header
                    const rId = parseInt(tData.regionId);
                    const rName = getRegionName(rId);
                    
                    setActiveRegion({ id: rId, name: rName });
                    setActiveThread(tData);
                    setView('thread');
                }
             } catch(e) { console.error("Deep link failed:", e); }
          } else if (regionId) {
              const rId = parseInt(regionId);
              const rName = getRegionName(rId);
              setActiveRegion({ id: rId, name: rName });
              setView('region');
          } else if (pageParam === 'codex') {
              setView('codex');
          }
      };

      // We only run this if the user is logged in and we are on the default 'map' view
      // This prevents overwriting state if the user navigates internally.
      if (user && view === 'map' && window.location.search) {
          initFromUrl();
      }
  }, [user]); // Run when user authenticates


  // --- 2. BROWSER NAVIGATION (BACK/FORWARD) ---
  useEffect(() => {
    const onPopState = (event) => {
        if (event.state) {
            isPopping.current = true;
            setView(event.state.view || 'map');
            setActiveRegion(event.state.activeRegion || null);
            setActiveThread(event.state.activeThread || null);
            setActiveCodexPage(event.state.activeCodexPage || null);
        } else {
            isPopping.current = true;
            setView('map');
        }
    };

    window.addEventListener('popstate', onPopState);
    if (!window.history.state) {
        window.history.replaceState({ view: 'map' }, '', window.location.pathname);
    }
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // --- 3. SYNC STATE TO URL ---
  useEffect(() => {
      if (isPopping.current) {
          isPopping.current = false;
          return;
      }

      const sanitize = (obj) => {
          if (!obj) return null;
          // Keep lightweight for history
          return { id: obj.id, name: obj.name, title: obj.title, regionId: obj.regionId };
      };

      const stateToPush = { 
          view,
          activeRegion: sanitize(activeRegion),
          activeThread: sanitize(activeThread),
          activeCodexPage: sanitize(activeCodexPage)
      };

      let url = window.location.pathname;
      if (view === 'region' && activeRegion) url = `?region=${activeRegion.id}`;
      else if (view === 'thread' && activeThread) url = `?thread=${activeThread.id}`;
      else if (view === 'codex') url = `?page=codex`;
      
      window.history.pushState(stateToPush, '', url);

  }, [view, activeRegion, activeThread, activeCodexPage]);


  // --- Data Fetching ---
  useEffect(() => {
    if (!user) return; 
    const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'));
    const unsub = onSnapshot(q, (snapshot) => {
      const pages = snapshot.docs.map(d => ({ id: d.id, gallery: [], ...d.data() }));
      pages.sort((a,b) => a.title.localeCompare(b.title));
      setCodexPages(pages);
    });
    return () => unsub();
  }, [user]);

  // --- Handlers ---
  const handleSearch = async (queryText) => {
    if (!queryText.trim()) return;
    setIsSearching(true);
    setView('search');

    const queryLower = queryText.toLowerCase();
    const matchedPages = codexPages.filter(p => p.title.toLowerCase().includes(queryLower) || p.content.toLowerCase().includes(queryLower));
    const matchedPosts = [];
    try {
      const postsSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'));
      postsSnap.forEach(doc => {
        const data = doc.data();
        if (data.content.toLowerCase().includes(queryLower) || (data.characterName && data.characterName.toLowerCase().includes(queryLower))) {
          matchedPosts.push({ id: doc.id, ...data });
        }
      });
      matchedPosts.sort((a,b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
    } catch (err) { console.error(err); }

    setSearchResults({ pages: matchedPages, posts: matchedPosts });
    setIsSearching(false);
  };

  const handleJumpToThread = async (post) => {
    try {
      const threadRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', post.threadId);
      const threadSnap = await getDoc(threadRef);
      if (threadSnap.exists()) {
        const threadData = { id: threadSnap.id, ...threadSnap.data() };
        const regionName = getRegionName(parseInt(threadData.regionId));
        setActiveRegion({ id: parseInt(threadData.regionId), name: regionName });
        setActiveThread(threadData);
        setView('thread');
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateCodexPage = () => {
    const newPage = { title: "", category: "General", content: "", gallery: [], isNew: true };
    setActiveCodexPage(newPage);
    setView('codex_page');
  };

  const handleOpenCodexPage = (page) => {
    setActiveCodexPage(page);
    setView('codex_page');
  };

  const handleOpenCodexByRelatedId = (relatedId) => {
     const page = codexPages.find(p => p.relatedId === relatedId || p.relatedId === relatedId.toString());
     if (page) {
         handleOpenCodexPage(page);
     } else {
         if (window.confirm("No Codex entry exists for this. Create one?")) {
             const newPage = { title: "New Entry", category: 'General', content: "", gallery: [], relatedId: relatedId.toString(), isNew: true };
             setActiveCodexPage(newPage);
             setView('codex_page');
         }
     }
  };

  // --- RENDERING ---

  if (loading) {
     return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-500"><Loader className="w-8 h-8 animate-spin"/></div>;
  }

  if (!user || !user.emailVerified) {
     return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      <Navbar setView={setView} onSearch={handleSearch} />
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {view === 'map' && <WorldMap setView={setView} setActiveRegion={setActiveRegion} />}
        {view === 'region' && <RegionView region={activeRegion} setView={setView} setActiveThread={setActiveThread} />}
        {view === 'thread' && <ThreadView thread={activeThread} setView={setView} region={activeRegion} onOpenCodex={handleOpenCodexByRelatedId} />}
        {view === 'codex' && <CodexIndex pages={codexPages} openPage={handleOpenCodexPage} createPage={handleCreateCodexPage} />}
        {view === 'codex_page' && <CodexEntry page={activeCodexPage} goBack={() => setView('codex')} />}
        {view === 'search' && <SearchResults query={isSearching ? "Searching..." : "Results"} results={searchResults} openPage={handleOpenCodexPage} openThread={handleJumpToThread} />}
      </main>
      <CharacterDrawer />
    </div>
  );
}