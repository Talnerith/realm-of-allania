"use client";
import { useState, useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import AuthScreen from '@/components/AuthScreen';
import Navbar from '@/components/Navbar';
import WorldMap from '@/components/WorldMap';
import RegionView from '@/components/Forum/RegionView';
import ThreadView from '@/components/Forum/ThreadView';
import CodexIndex from '@/components/Codex/CodexIndex';
import CodexEntry from '@/components/Codex/CodexEntry';
import SearchResults from '@/components/Codex/SearchResults';
import CharacterDrawer from '@/components/CharacterDrawer';
import ChatSystem from '@/components/ChatSystem';
import LegalDocs from '@/components/Legal/LegalDocs';
import CookieBanner from '@/components/Legal/CookieBanner';

export default function Home() {
  const gameContext = useGame();
  
  // Navigation State
  const [view, setView] = useState('map'); 
  const [activeRegion, setActiveRegion] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [activeCodexPage, setActiveCodexPage] = useState(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState(''); 
  const [searchKey, setSearchKey] = useState(0); // Forces re-render on new search
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState(null);

  // --- HISTORY MANAGEMENT (Back Button Logic) ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
        window.history.replaceState({ view: 'map' }, '');
    }

    const onPopState = (event) => {
        const state = event.state;
        if (state && state.view) {
            setView(state.view);
            if (state.view === 'search' && state.query) {
                setSearchQuery(state.query);
                setSearchKey(prev => prev + 1);
            }
        } else {
            setView('map');
        }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (newView, extraState = {}) => {
      if (view === newView && newView !== 'search') return; 

      setView(newView);
      window.history.pushState({ view: newView, ...extraState }, '');
  };

  if (!gameContext) return null;
  const { user, loading } = gameContext;

  // Handlers
  const handleRegionSelect = (region) => {
    setActiveRegion(region);
    navigateTo('region', { regionId: region.id });
  };

  const handleThreadSelect = (thread) => {
    setActiveThread(thread);
    navigateTo('thread', { threadId: thread.id });
  };

  const handleCodexOpen = (pageId = null) => {
      navigateTo('codex');
  };
  
  const handleOpenCodexEntry = (page) => {
      setActiveCodexPage(page);
      navigateTo('codex_entry', { pageId: page.id });
  };

  const handleMessageUser = (targetUser) => {
      setChatTarget(targetUser);
      setIsChatOpen(true);
  };

  const handleSearch = (query) => {
      if (!query || !query.trim()) return;
      const cleanQuery = query.trim();
      setSearchQuery(cleanQuery);
      setSearchKey(prev => prev + 1);
      setView('search');
      window.history.pushState({ view: 'search', query: cleanQuery }, '');
  };

  // 1. Loading State
  if (loading) return <div className="h-screen w-screen bg-black flex items-center justify-center text-amber-500 font-serif">Loading Realm...</div>;

  // 2. Auth State (Pass setView to allow Legal access from Login)
  if (!user) return <AuthScreen onLegalClick={() => navigateTo('legal')} currentView={view} onBack={() => setView('map')} />;

  return (
    <main className="h-screen w-screen bg-black overflow-hidden flex flex-col relative text-slate-200 font-sans selection:bg-amber-900 selection:text-white">
      
      {/* 1. TOP NAVIGATION */}
      <Navbar 
        currentView={view} 
        setView={navigateTo}
        onSearch={handleSearch} 
        onToggleChat={() => setIsChatOpen(!isChatOpen)} 
      />

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 relative overflow-hidden">
        
        {view === 'map' && (
          <WorldMap 
            setView={navigateTo} 
            setActiveRegion={handleRegionSelect} 
          />
        )}

        {view === 'region' && (
          <RegionView 
            region={activeRegion} 
            setView={navigateTo} 
            setActiveThread={handleThreadSelect}
          />
        )}

        {view === 'thread' && (
          <ThreadView 
            thread={activeThread} 
            region={activeRegion}
            setView={navigateTo}
            onOpenCodex={handleCodexOpen}
            onMessageUser={handleMessageUser}
          />
        )}

        {view === 'codex' && (
            <CodexIndex 
                onOpenEntry={handleOpenCodexEntry}
            />
        )}

        {view === 'codex_entry' && (
            <CodexEntry 
                page={activeCodexPage}
                goBack={() => navigateTo('codex')}
            />
        )}

        {view === 'search' && (
            <SearchResults 
                key={searchKey}
                query={searchQuery}
                onNavigate={navigateTo}
                onOpenThread={handleThreadSelect}
                onOpenCodex={handleOpenCodexEntry}
            />
        )}

        {/* NEW LEGAL VIEW */}
        {view === 'legal' && (
            <LegalDocs goBack={() => navigateTo('map')} />
        )}

      </div>

      {/* 3. OVERLAYS */}
      <CharacterDrawer />
      
      <ChatSystem 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        initialChatUser={chatTarget}
      />

      <CookieBanner />

    </main>
  );
}