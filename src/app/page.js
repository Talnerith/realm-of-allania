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
import CharacterDrawer from '@/components/CharacterDrawer';
import ChatSystem from '@/components/ChatSystem';
import AdminMigrationTool from '@/components/AdminMigrationTool'; // IMPORTED

export default function Home() {
  const { user, loading } = useGame();
  
  // Navigation State
  const [view, setView] = useState('map'); // map, region, thread, codex, codex_entry
  const [activeRegion, setActiveRegion] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [activeCodexPage, setActiveCodexPage] = useState(null);
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState(null);

  // Handlers
  const handleRegionSelect = (region) => {
    setActiveRegion(region);
    setView('region');
  };

  const handleThreadSelect = (thread) => {
    setActiveThread(thread);
    setView('thread');
  };

  const handleCodexOpen = (pageId = null) => {
      // If pageId is passed (e.g. from a post avatar click), we'd usually fetch that page.
      // For now, we just open the index. 
      // In a full implementation, you'd fetch the codex page by 'relatedId' == characterId
      setView('codex');
  };
  
  const handleOpenCodexEntry = (page) => {
      setActiveCodexPage(page);
      setView('codex_entry');
  };

  const handleMessageUser = (targetUser) => {
      setChatTarget(targetUser);
      setIsChatOpen(true);
  };

  if (loading) return <div className="h-screen w-screen bg-black flex items-center justify-center text-amber-500 font-serif">Loading Realm...</div>;

  if (!user) return <AuthScreen />;

  return (
    <main className="h-screen w-screen bg-black overflow-hidden flex flex-col relative text-slate-200 font-sans selection:bg-amber-900 selection:text-white">
      
      {/* 1. TOP NAVIGATION */}
      <Navbar 
        currentView={view} 
        setView={setView} 
        onToggleChat={() => setIsChatOpen(!isChatOpen)} 
      />

      {/* 2. ADMIN MIGRATION TOOL (Temporary) */}
      {/* Only visible to admins, checks handled inside component */}
      <div className="relative z-50">
          <AdminMigrationTool />
      </div>

      {/* 3. MAIN CONTENT AREA */}
      <div className="flex-1 relative overflow-hidden">
        
        {view === 'map' && (
          <WorldMap 
            setView={setView} 
            setActiveRegion={handleRegionSelect} 
          />
        )}

        {view === 'region' && (
          <RegionView 
            region={activeRegion} 
            setView={setView} 
            setActiveThread={handleThreadSelect}
          />
        )}

        {view === 'thread' && (
          <ThreadView 
            thread={activeThread} 
            region={activeRegion}
            setView={setView}
            onOpenCodex={handleCodexOpen}
            onMessageUser={handleMessageUser}
          />
        )}

        {view === 'codex' && (
            <CodexIndex 
                setView={setView}
                onOpenEntry={handleOpenCodexEntry}
            />
        )}

        {view === 'codex_entry' && (
            <CodexEntry 
                page={activeCodexPage}
                goBack={() => setView('codex')}
            />
        )}

      </div>

      {/* 4. OVERLAYS */}
      <CharacterDrawer />
      
      <ChatSystem 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        initialChatUser={chatTarget}
      />

    </main>
  );
}