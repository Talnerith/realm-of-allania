"use client";
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
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

  // SEO: Guest Mode
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
    if (view === newView && newView !== 'search' && newView !== 'codex_entry') return;
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

  // Used by Search & Codex Index (Passes full Page Object)
  const handleOpenCodexEntry = (page) => {
    setActiveCodexPage(page);
    navigateTo('codex_entry', { pageId: page.id });
  };

  // Used by ThreadView (Passes Character ID string)
  const handleCodexOpen = async (characterId = null) => {
    if (!characterId) {
      navigateTo('codex');
      return;
    }

    try {
      // Find the page where 'relatedId' matches the characterId
      const q = query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'),
        where('relatedId', '==', characterId),
        limit(1)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const pageData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        handleOpenCodexEntry(pageData);
      } else {
        alert("This character has not yet been chronicled in the Codex.");
        navigateTo('codex');
      }
    } catch (e) {
      console.error("Codex Lookup Error:", e);
      navigateTo('codex');
    }
  };

  // NEW: Wiki Link Handler
  // Tries to find a page by title. If not found, runs a search.
  const handleWikiLink = async (targetTitle) => {
    if (!targetTitle) return;
    console.log("Navigating via Wiki Link:", targetTitle);

    try {
      // 1. Try Exact Title Match
      const q = query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'),
        where('title', '==', targetTitle),
        limit(1)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const page = { id: snap.docs[0].id, ...snap.docs[0].data() };
        handleOpenCodexEntry(page);
      } else {
        // 2. Fallback to Search
        handleSearch(targetTitle);
      }
    } catch (e) {
      console.error("Wiki Link Error:", e);
      handleSearch(targetTitle);
    }
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
            onWikiLink={handleWikiLink}
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
            onWikiLink={handleWikiLink}
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
            onWikiLink={handleWikiLink}
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

      {user && <CharacterDrawer />}

      {user && (
        <ChatSystem
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          initialChatUser={chatTarget}
        />
      )}

      <CookieBanner />

      {/* 4. AUTH MODAL */}
      {((!user && showLoginModal) || (user && !user.emailVerified && !user.isAnonymous)) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
          <div className="relative w-full max-w-md">
            {(!user) && (
              <button
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 z-50 text-slate-400 hover:text-white"
              >
                Close
              </button>
            )}
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