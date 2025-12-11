'use client';
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID, getRegionName } from '@/lib/constants';
import { GameProvider } from '@/context/GameContext';

// Components
import Navbar from '@/components/Navbar';
import WorldMap from '@/components/WorldMap';
import CharacterDrawer from '@/components/CharacterDrawer';
import RegionView from '@/components/Forum/RegionView';
import ThreadView from '@/components/Forum/ThreadView';
import CodexIndex from '@/components/Codex/CodexIndex';
import CodexEntry from '@/components/Codex/CodexEntry';
import SearchResults from '@/components/Codex/SearchResults';

export default function Home() {
  return (
    <GameProvider>
       <GameContainer />
    </GameProvider>
  );
}

function GameContainer() {
  // Navigation State
  const [view, setView] = useState('map'); // map, region, thread, codex, codex_page, search
  const [activeRegion, setActiveRegion] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [activeCodexPage, setActiveCodexPage] = useState(null);

  // Search State
  const [codexPages, setCodexPages] = useState([]);
  const [searchResults, setSearchResults] = useState({ pages: [], posts: [] });
  const [isSearching, setIsSearching] = useState(false);

  // --- Data Fetching (Codex Cache for Search) ---
  useEffect(() => {
    const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'));
    const unsub = onSnapshot(q, (snapshot) => {
      const pages = snapshot.docs.map(d => ({ id: d.id, gallery: [], ...d.data() }));
      // Sort: Lore first, then Region, then Character
      pages.sort((a,b) => a.title.localeCompare(b.title));
      setCodexPages(pages);
    });
    return () => unsub();
  }, []);

  // --- Global Handlers ---

  const handleSearch = async (queryText) => {
    if (!queryText.trim()) return;
    setIsSearching(true);
    setView('search');

    const queryLower = queryText.toLowerCase();
    
    // 1. Search Codex (In-Memory)
    const matchedPages = codexPages.filter(p => 
      p.title.toLowerCase().includes(queryLower) || 
      p.content.toLowerCase().includes(queryLower)
    );

    // 2. Search Threads (Database Query)
    const matchedPosts = [];
    try {
      // Note: In a real app, use Algolia. This is a client-side scan for prototype.
      const postsSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'));
      postsSnap.forEach(doc => {
        const data = doc.data();
        if (
             data.content.toLowerCase().includes(queryLower) || 
             (data.characterName && data.characterName.toLowerCase().includes(queryLower))
           ) {
          matchedPosts.push({ id: doc.id, ...data });
        }
      });
      // Sort by date
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
        // We need the region name for the UI header
        const regionName = getRegionName(parseInt(threadData.regionId));
        
        setActiveRegion({ id: parseInt(threadData.regionId), name: regionName });
        setActiveThread(threadData);
        setView('thread');
      }
    } catch (e) { console.error("Error jumping to thread:", e); }
  };

  // --- Codex Logic ---
  const handleCreateCodexPage = () => {
    // Create a temporary "New" object
    const newPage = { 
        title: "", 
        category: "General", 
        content: "", 
        gallery: [], 
        isNew: true 
    };
    setActiveCodexPage(newPage);
    setView('codex_page');
  };

  const handleOpenCodexPage = (page) => {
    setActiveCodexPage(page);
    setView('codex_page');
  };

  // Open Codex from a Character/Region click (Find by related ID)
  const handleOpenCodexByRelatedId = (relatedId) => {
     const page = codexPages.find(p => p.relatedId === relatedId || p.relatedId === relatedId.toString());
     if (page) {
         handleOpenCodexPage(page);
     } else {
         // If no page exists, offer to create one
         if (window.confirm("No Codex entry exists for this. Create one?")) {
             const newPage = { 
                 title: "New Entry", 
                 category: 'General', 
                 content: "", 
                 gallery: [], 
                 relatedId: relatedId.toString(), 
                 isNew: true 
             };
             setActiveCodexPage(newPage);
             setView('codex_page');
         }
     }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      
      {/* 1. Header */}
      <Navbar setView={setView} onSearch={handleSearch} />

      {/* 2. Main Viewport */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        
        {view === 'map' && (
            <WorldMap 
                setView={setView} 
                setActiveRegion={setActiveRegion} 
            />
        )}

        {view === 'region' && (
            <RegionView 
                region={activeRegion} 
                setView={setView} 
                setActiveThread={setActiveThread} 
            />
        )}

        {view === 'thread' && (
            <ThreadView 
                thread={activeThread} 
                setView={setView} 
                region={activeRegion}
                onOpenCodex={handleOpenCodexByRelatedId}
            />
        )}

        {view === 'codex' && (
            <CodexIndex 
                pages={codexPages} 
                openPage={handleOpenCodexPage} 
                createPage={handleCreateCodexPage}
            />
        )}

        {view === 'codex_page' && (
            <CodexEntry 
                page={activeCodexPage} 
                goBack={() => setView('codex')} 
            />
        )}

        {view === 'search' && (
            <SearchResults 
                query={isSearching ? "Searching..." : "Results"} 
                results={searchResults} 
                openPage={handleOpenCodexPage} 
                openThread={handleJumpToThread} 
            />
        )}

      </main>

      {/* 3. Global Overlays */}
      <CharacterDrawer />

    </div>
  );
}