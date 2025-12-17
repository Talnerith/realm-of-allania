import { Crown, Search, Book, LogOut, User, Copy, Check, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore'; // NEW Imports
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { useGame } from '@/context/GameContext';

export default function Navbar({ setView, onSearch, onOpenChat }) {
  const { user, logout, readReceipts } = useGame(); // We need readReceipts from Context
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // NEW: Listen for Unread Chats
  useEffect(() => {
    if (!user) return;

    // Listen to all chats I am in
    const q = query(collection(db, 'artifacts', APP_ID, 'chats'), where('participants', 'array-contains', user.uid));
    
    const unsub = onSnapshot(q, (snapshot) => {
        let foundUnread = false;
        snapshot.docs.forEach(doc => {
            const chat = doc.data();
            // Get my last read time for this specific chat
            const lastRead = readReceipts[doc.id] || 0;
            const updated = chat.updatedAt?.toMillis() || 0;
            
            // If the chat has been updated since I last read it...
            if (updated > lastRead) {
                foundUnread = true;
            }
        });
        setHasUnread(foundUnread);
    });

    return () => unsub();
  }, [user, readReceipts]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
        onSearch(searchQuery);
    }
  };

  const copyUserId = () => {
      if (user?.uid) {
          navigator.clipboard.writeText(user.uid);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  return (
    <header className="h-16 border-b border-amber-900/30 bg-slate-950 flex items-center justify-between px-6 z-40 shrink-0 shadow-lg gap-4">
      <div 
        className="flex items-center gap-3 shrink-0 cursor-pointer group" 
        onClick={() => setView('map')}
      >
        <Crown className="w-6 h-6 text-amber-500 group-hover:text-amber-400 transition-colors" />
        <h1 className="text-xl font-serif font-bold tracking-wide text-amber-100 hidden md:block group-hover:text-white transition-colors">
          REALM OF ALLANIA
        </h1>
      </div>
      
      <div className="flex-1 max-w-lg flex items-center gap-2">
          <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <form onSubmit={handleSearchSubmit}>
                  <input 
                      className="w-full bg-slate-900 border border-slate-700 rounded-full pl-10 pr-4 py-1.5 text-sm focus:border-amber-500 focus:outline-none transition-all text-slate-200 placeholder:text-slate-600"
                      placeholder="Search threads, lore, regions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                  />
              </form>
          </div>
          <button 
              onClick={() => setView('codex')} 
              className="p-2 text-slate-400 hover:text-amber-100 hover:bg-slate-800 rounded-full transition-colors"
              title="Open Codex"
          >
              <Book className="w-5 h-5" />
          </button>
      </div>
      
      <div className="flex items-center gap-4 md:gap-6 text-sm text-slate-500 shrink-0">
        
        {/* Chat Toggle with Notification Dot */}
        <button 
           onClick={onOpenChat}
           className="relative p-2 text-slate-400 hover:text-amber-500 transition-colors"
           title="Messages"
        >
            <MessageCircle className="w-5 h-5" />
            {/* The Red Dot */}
            {hasUnread && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse"></span>
            )}
        </button>

        <div className="hidden md:flex items-center gap-2 cursor-pointer group" onClick={copyUserId} title="Click to copy User ID for Admin">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-slate-400 font-medium max-w-[150px] truncate group-hover:text-amber-500 transition-colors">
                {user?.displayName || 'Traveler'}
            </span>
            {copied ? <Check className="w-3 h-3 text-emerald-500"/> : <Copy className="w-3 h-3 text-slate-600 group-hover:text-amber-500"/>}
        </div>
        
        <button 
            onClick={logout}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors"
            title="Sign Out"
        >
            <LogOut className="w-5 h-5" />
            <span className="hidden md:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}