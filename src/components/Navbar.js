import { useState } from 'react';
import { Search, Map, Book, MessageCircle, LogOut, Menu, X, Bell, Shield, Crown } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Navbar({ currentView, setView, onSearch, onToggleChat }) {
  const { user, userRole, logout } = useGame();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSubmitSearch = (e) => {
      e.preventDefault();
      if (searchInput.trim()) {
          onSearch(searchInput);
          setMobileMenuOpen(false);
          // Optional: Clear input after search, or keep it to show what they searched
          setSearchInput('');
      }
  };

  const navItems = [
    { id: 'map', label: 'World Map', icon: Map },
    { id: 'codex', label: 'Codex', icon: Book },
  ];

  return (
    <nav className="h-16 bg-slate-950 border-b border-amber-900/50 flex items-center justify-between px-4 md:px-8 z-40 relative shadow-lg">
      
      {/* 1. Logo / Brand */}
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('map')}>
        {/* Styled Logo Icon */}
        <div className="relative w-10 h-10 flex items-center justify-center">
            {/* Background Shield */}
            <Shield className="w-10 h-10 text-amber-900 fill-amber-950 absolute inset-0 drop-shadow-md group-hover:text-amber-800 transition-colors" />
            {/* Inner Crown/Crest */}
            <Crown className="w-5 h-5 text-amber-500 relative z-10 drop-shadow-sm" />
        </div>
        <div className="flex flex-col">
            <span className="font-serif font-bold text-lg text-amber-100 leading-none tracking-wide group-hover:text-amber-50 transition-colors">Realm of Allania</span>
            <span className="text-[10px] text-amber-500/80 uppercase tracking-[0.2em] leading-none">Chronicles</span>
        </div>
      </div>

      {/* 2. Desktop Navigation */}
      <div className="hidden md:flex items-center gap-6">
        {/* Search Bar */}
        <form onSubmit={handleSubmitSearch} className="relative group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
            <input 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search lore..." 
                className="bg-slate-900 border border-slate-700 rounded-full py-1.5 pl-9 pr-4 text-sm text-slate-200 focus:border-amber-500 focus:outline-none w-48 transition-all focus:w-64"
            />
        </form>

        <div className="h-6 w-px bg-slate-800 mx-2"></div>

        {navItems.map(item => (
            <button 
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all ${currentView === item.id ? 'bg-amber-900/30 text-amber-500' : 'text-slate-400 hover:text-amber-200 hover:bg-slate-900'}`}
            >
                <item.icon className="w-4 h-4" />
                <span className="font-bold text-sm uppercase tracking-wider">{item.label}</span>
            </button>
        ))}

        <button onClick={onToggleChat} className="relative p-2 text-slate-400 hover:text-white transition-colors">
            <MessageCircle className="w-5 h-5" />
        </button>

        <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-400 transition-colors" title="Sign Out">
            <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* 3. Mobile Menu Toggle */}
      <div className="flex md:hidden items-center gap-4">
          <button onClick={onToggleChat} className="text-slate-400 hover:text-white"><MessageCircle className="w-6 h-6" /></button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-200">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
      </div>

      {/* 4. Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-slate-900 border-b border-amber-900/50 p-4 flex flex-col gap-4 md:hidden shadow-2xl animate-in slide-in-from-top-5">
             <form onSubmit={handleSubmitSearch} className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search lore..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 pl-10 text-slate-200 focus:border-amber-500 focus:outline-none"
                />
            </form>
            {navItems.map(item => (
                <button 
                    key={item.id}
                    onClick={() => { setView(item.id); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 p-3 rounded ${currentView === item.id ? 'bg-amber-900/30 text-amber-500 border border-amber-900/50' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                    <item.icon className="w-5 h-5" />
                    <span className="font-bold">{item.label}</span>
                </button>
            ))}
            <button onClick={handleLogout} className="flex items-center gap-3 p-3 text-red-400 hover:bg-red-900/20 rounded">
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
            </button>
        </div>
      )}
    </nav>
  );
}