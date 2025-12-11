import { Crown, Search, Book, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { useGame } from '@/context/GameContext';

export default function Navbar({ setView, onSearch }) {
  const { user, logout } = useGame();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
        onSearch(searchQuery);
    }
  };

  return (
    <header className="h-16 border-b border-amber-900/30 bg-slate-950 flex items-center justify-between px-6 z-40 shrink-0 shadow-lg gap-4">
      {/* Logo Area */}
      <div 
        className="flex items-center gap-3 shrink-0 cursor-pointer group" 
        onClick={() => setView('map')}
      >
        <Crown className="w-6 h-6 text-amber-500 group-hover:text-amber-400 transition-colors" />
        <h1 className="text-xl font-serif font-bold tracking-wide text-amber-100 hidden md:block group-hover:text-white transition-colors">
          REALM OF AETHELRAED
        </h1>
      </div>
      
      {/* Search Bar */}
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
      
      {/* User / Logout Area */}
      <div className="flex items-center gap-6 text-sm text-slate-500 shrink-0">
        {/* User Status */}
        <div className="hidden md:flex items-center gap-2 cursor-default" title={user?.email}>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-slate-400 font-medium max-w-[150px] truncate">
                {user?.displayName || 'Traveler'}
            </span>
        </div>
        
        {/* Logout Button */}
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