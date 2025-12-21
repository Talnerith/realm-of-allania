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
  const [searchKey, setSearchKey] = useState(0); 
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState(null);

  // SEO: Guest Mode defaults to FALSE if checking auth, but we allow rendering now.
  const [showLoginModal, setShowLoginModal] = useState(false);

  // --- HISTORY MANAGEMENT ---
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
      if (!user) { setShowLoginModal(true); return; }
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

  if (loading) return <div className="h-screen w-screen bg-black flex items-center justify-center text-amber-500 font-serif">Loading Realm...</div>;

  return (
    <main className="h-screen w-screen bg-black overflow-hidden flex flex-col relative text-slate-200 font-sans selection:bg-amber-900 selection:text-white">
      
      {/* 1. TOP NAVIGATION */}
      <Navbar 
        currentView={view} 
        setView={navigateTo}
        onSearch={handleSearch} 
        onToggleChat={() => user ? setIsChatOpen(!isChatOpen) : setShowLoginModal(true)}
        onLoginClick={() => setShowLoginModal(true)}
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
            onRequireAuth={() => setShowLoginModal(true)}
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

        {view === 'legal' && (
            <LegalDocs goBack={() => navigateTo('map')} />
        )}

      </div>

      {/* 3. OVERLAYS */}
      
      {/* Character Drawer - Only show if logged in */}
      {user && <CharacterDrawer />}
      
      {/* Chat - Only show if logged in */}
      {user && (
        <ChatSystem 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)}
            initialChatUser={chatTarget}
        />
      )}

      {/* Cookie Banner - Show for everyone until accepted */}
      <CookieBanner />

      {/* 4. AUTH MODAL (If Not Logged In and Requested) */}
      {(!user && showLoginModal) && (
          // FIX: Changed z-[100] to z-50. Since this is the last element in the DOM,
          // it will stack on top of other z-50 elements (like Chat/Drawer) automatically.
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
              <div className="relative w-full max-w-md">
                <button 
                    onClick={() => setShowLoginModal(false)}
                    // FIX: Changed z-[110] to z-50. Sufficient to be above the AuthScreen content.
                    className="absolute top-4 right-4 z-50 text-slate-400 hover:text-white"
                >
                    Close
                </button>
                <AuthScreen 
                    onLegalClick={() => { setShowLoginModal(false); navigateTo('legal'); }} 
                    currentView={view} 
                    onBack={() => { setShowLoginModal(false); navigateTo('map'); }}
                />
              </div>
          </div>
      )}

    </main>
  );
}