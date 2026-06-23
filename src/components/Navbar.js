import { useState, memo } from 'react';
import Link from 'next/link';
import { Search, Map, Book, MessageCircle, LogOut, Menu, X, Shield, Crown, LogIn, Users, Heart } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import ActiveUsers from '@/components/ActiveUsers';
import NotificationBell from '@/components/NotificationBell';

function Navbar({ currentView, setView, onSearch, onToggleChat, onLoginClick, unreadCount }) {
  const { user, userRole, logout } = useGame();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [showActiveUsers, setShowActiveUsers] = useState(false);

  // Single donation surface: one Ko-fi link (PayPal/Stripe are configured
  // inside Ko-fi, not as separate buttons). Env-gated — the button is omitted
  // entirely until the handle exists, so no dead link ships.
  const kofiUrl = process.env.NEXT_PUBLIC_KOFI_URL;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSubmitSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput);
      setMobileMenuOpen(false);
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
      <button
        className="flex items-center gap-3 cursor-pointer group bg-transparent border-none p-0 text-left"
        onClick={() => setView('map')}
        aria-label="Go to World Map"
      >
        <div className="relative w-10 h-10 flex items-center justify-center">
          <Shield className="w-10 h-10 text-amber-900 fill-amber-950 absolute inset-0 drop-shadow-md group-hover:text-amber-800 transition-colors" />
          <Crown className="w-5 h-5 text-amber-500 relative z-10 drop-shadow-sm" />
        </div>
        <div className="flex flex-col">
          <span className="font-serif font-bold text-lg text-amber-100 leading-none tracking-wide group-hover:text-amber-50 transition-colors">Realm of Allania</span>
          <span className="text-[10px] text-amber-500/80 uppercase tracking-[0.2em] leading-none">Chronicles</span>
        </div>
      </button>

      {/* 2. Desktop Navigation */}
      <div className="hidden md:flex items-center gap-6">
        <form onSubmit={handleSubmitSearch} className="relative group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search lore..."
            aria-label="Search lore"
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

        {user ? (
          <>
            <button onClick={() => setShowActiveUsers(true)} className="relative p-2 text-slate-400 hover:text-white transition-colors" aria-label="Active Users" title="Active Users">
              <Users className="w-5 h-5" />
            </button>
            <NotificationBell />
            <button onClick={onToggleChat} className="relative p-2 text-slate-400 hover:text-white transition-colors" aria-label="Toggle Chat" title="Chat">
              <MessageCircle className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 text-[10px] font-bold text-white flex items-center justify-center rounded-full shadow-lg border border-slate-950 animate-in zoom-in-50">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-400 transition-colors" title="Sign Out" aria-label="Sign Out">
              <LogOut className="w-5 h-5" />
            </button>
          </>
        ) : (
          <button onClick={onLoginClick} className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white px-4 py-1.5 rounded text-sm font-bold transition-colors">
            <LogIn className="w-4 h-4" /> Login
          </button>
        )}

        {kofiUrl && (
          <a href={kofiUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-amber-500 transition-colors cursor-pointer" title="Support the Realm" aria-label="Support the Realm">
            <Heart className="w-5 h-5" />
          </a>
        )}

        <button onClick={() => setView('legal')} className="p-2 text-slate-500 hover:text-amber-500 transition-colors" title="Legal & Terms" aria-label="Legal & Terms">
          <Shield className="w-5 h-5" />
        </button>

        {(userRole === 'admin' || userRole === 'moderator') && (
          <Link href="/admin/moderation" className="ml-2 flex items-center gap-2 bg-red-900/30 text-red-400 border border-red-900/50 hover:bg-red-900/50 px-3 py-1.5 rounded text-sm font-bold transition-colors">
            <Shield className="w-4 h-4" /> Mod
          </Link>
        )}
      </div>

      {/* 3. Mobile Menu Toggle */}
      <div className="flex md:hidden items-center gap-4">
        {user && (
          <>
            <NotificationBell />
            <button onClick={onToggleChat} className="relative text-slate-400 hover:text-white" aria-label="Toggle Chat">
              <MessageCircle className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-[10px] font-bold text-white flex items-center justify-center rounded-full shadow-lg border border-slate-950">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </>
        )}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-200" aria-label={mobileMenuOpen ? "Close Menu" : "Open Menu"}>
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
              aria-label="Search lore"
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

          {user ? (
            <>
              <button onClick={() => { setShowActiveUsers(true); setMobileMenuOpen(false); }} className="flex items-center gap-3 p-3 text-slate-300 hover:bg-slate-800 rounded">
                <Users className="w-5 h-5" />
                <span>Active Users</span>
              </button>
              <button onClick={handleLogout} className="flex items-center gap-3 p-3 text-red-400 hover:bg-red-900/20 rounded">
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <button onClick={() => { onLoginClick(); setMobileMenuOpen(false); }} className="flex items-center gap-3 p-3 text-amber-500 hover:bg-slate-800 rounded">
              <LogIn className="w-5 h-5" />
              <span>Login / Join</span>
            </button>
          )}

          {kofiUrl && (
            <a href={kofiUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 text-slate-300 hover:bg-slate-800 rounded">
              <Heart className="w-5 h-5 text-amber-600" />
              <span>Support the Realm</span>
            </a>
          )}

          <button onClick={() => { setView('legal'); setMobileMenuOpen(false); }} className="flex items-center gap-3 p-3 text-slate-400 hover:bg-slate-800 rounded">
            <Shield className="w-5 h-5 text-amber-600" />
            <span>Legal & Copyright</span>
          </button>

          {(userRole === 'admin' || userRole === 'moderator') && (
            <Link href="/admin/moderation" className="flex items-center gap-3 p-3 bg-red-900/30 text-red-400 border border-red-900/50 hover:bg-red-900/50 rounded" onClick={() => setMobileMenuOpen(false)}>
              <Shield className="w-5 h-5" />
              <span>Moderation</span>
            </Link>
          )}
        </div>
      )}
      <ActiveUsers isOpen={showActiveUsers} onClose={() => setShowActiveUsers(false)} />
    </nav>
  );
}

export default memo(Navbar);