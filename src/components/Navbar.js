import { useState, useEffect, useRef, memo } from 'react';
import Link from 'next/link';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { LocateFixed, BookOpen, Users, Search, Mail, Menu, X, ChevronDown, LogIn, Shield, Heart, Check } from 'lucide-react';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { CREST_IMG } from '@/lib/artAssets';
import { useGame } from '@/context/GameContext';
import ActiveUsers from '@/components/ActiveUsers';
import NotificationBell from '@/components/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';
import AccountName from '@/components/AccountName';
import Avatar from '@/components/Avatar';
import ProfileEditor from '@/components/ProfileEditor';

// Main tabs. Region and thread pages live under the World Map tab.
const NAV_ITEMS = [
  { id: 'map', label: 'World Map', icon: LocateFixed, views: ['map', 'region', 'thread'] },
  { id: 'codex', label: 'Codex', icon: BookOpen, views: ['codex', 'codex_entry'] },
  { id: 'members', label: 'Members', icon: Users, views: [] },
  { id: 'search', label: 'Search', icon: Search, views: ['search'] },
];

const menuItemCls = 'text-left text-sm rounded-lg px-3 py-2 transition-colors hover:bg-ink-800';

function Navbar({ currentView, setView, onSearch, onToggleChat, onLoginClick, unreadCount }) {
  const { user, userRole, logout, hideWelcome, setHideWelcome, displayName: accountName, updateDisplayName, avatar, updateAvatar } = useGame();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [showActiveUsers, setShowActiveUsers] = useState(false);
  const headerRef = useRef(null);
  const searchRef = useRef(null);

  // Single notifications listener for the bell
  const [notifications, setNotifications] = useState([]);
  useEffect(() => {
    if (!user || !db) return;
    const q = query(
      collection(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => console.error("Notifications error:", error));
    return () => { unsub(); setNotifications([]); };
  }, [user]);

  // Menus and the search panel close on Escape or a click outside the header
  const anyOpen = mobileMenuOpen || userMenuOpen || searchOpen;
  useEffect(() => {
    if (!anyOpen) return;
    const close = () => { setMobileMenuOpen(false); setUserMenuOpen(false); setSearchOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onPointer = (e) => { if (headerRef.current && !headerRef.current.contains(e.target)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [anyOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Single donation surface in the navbar: a Ko-fi link, env-gated so no dead
  // link ships before the handle exists
  const kofiUrl = process.env.NEXT_PUBLIC_KOFI_URL;
  const isStaff = userRole === 'admin' || userRole === 'moderator';
  const displayName = accountName || user?.displayName || 'Adventurer';

  const closeAll = () => { setMobileMenuOpen(false); setUserMenuOpen(false); setSearchOpen(false); };
  const openProfile = () => { closeAll(); setProfileOpen(true); };

  const handleLogout = async () => {
    closeAll();
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
      setSearchInput('');
      closeAll();
    }
  };

  const handleNav = (id) => {
    if (id === 'search') {
      setMobileMenuOpen(false);
      setUserMenuOpen(false);
      setSearchOpen(open => !open);
      return;
    }
    closeAll();
    if (id === 'members') {
      if (user) setShowActiveUsers(true);
      else onLoginClick();
      return;
    }
    setView(id);
  };

  const isActive = (item) => {
    if (item.id === 'search') return searchOpen || (currentView === 'search');
    if (item.id === 'members') return showActiveUsers;
    return !searchOpen && item.views.includes(currentView);
  };

  const openLegal = () => { closeAll(); setView('legal'); };

  // "Show welcome page" — the account-menu switch for the Landing page's
  // "Don't show this again"
  const showWelcome = hideWelcome !== true;
  const toggleWelcome = () => {
    const hide = showWelcome;
    setHideWelcome?.(hide);
    try {
      if (hide) localStorage.setItem('skipLanding', 'true');
      else localStorage.removeItem('skipLanding');
    } catch { /* storage blocked */ }
  };
  const welcomeItem = (cls) => setHideWelcome && (
    <button type="button" role="menuitemcheckbox" aria-checked={showWelcome} onClick={toggleWelcome} className={`${cls} flex items-center justify-between gap-2 text-ink-200`}>
      Show welcome page
      <span className={`w-4 h-4 rounded-sm border flex items-center justify-center ${showWelcome ? 'bg-gold-700 border-gold-700 text-white' : 'border-ink-600'}`} aria-hidden="true">
        {showWelcome && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>
    </button>
  );

  return (
    <header ref={headerRef} className="relative z-40 h-20 shrink-0 bg-ink-950 border-b border-gold-900/50">
      <div className="h-full flex items-center gap-3 px-4 md:px-6">
        {/* 1. Brand */}
        <div className="h-full flex flex-1 basis-0 items-center min-w-0">
          <button
            type="button"
            onClick={() => { closeAll(); setView('map'); }}
            aria-label="Realm of Allania, go to World Map"
            className="h-full flex items-center gap-3 min-w-0 text-left"
          >
            <img src={CREST_IMG.src} srcSet={CREST_IMG.srcSet} alt="" className="h-12 w-auto shrink-0 block" />
            <span className="flex flex-col min-w-0">
              <span className="font-serif font-bold text-gold-100 leading-none text-xl md:text-3xl whitespace-nowrap">Realm of Allania</span>
              <span className="text-gold-500 uppercase leading-none text-[clamp(.625rem,.4rem+.5vw,.8125rem)] tracking-[.32em] mt-[.4rem]">Chronicles</span>
            </span>
          </button>
        </div>

        {/* 2. Main tabs (lg and up) */}
        <nav aria-label="Main" className="hidden lg:flex h-full items-stretch gap-1">
          {NAV_ITEMS.map(item => {
            const on = isActive(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                aria-current={on && item.id !== 'search' && item.id !== 'members' ? 'page' : undefined}
                aria-expanded={item.id === 'search' ? searchOpen : undefined}
                className={`h-full flex items-center gap-2 px-4 text-base border-y-2 border-t-transparent transition-colors ${on ? 'text-gold-500 border-b-gold-500' : 'text-ink-200 hover:text-gold-300 border-b-transparent'}`}
              >
                <item.icon className="w-[18px] h-[18px]" strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 3. Account area */}
        <div className="flex flex-1 basis-0 items-center justify-end gap-1 md:gap-2">
          {user ? (
            <>
              <button
                type="button"
                onClick={() => { closeAll(); onToggleChat(); }}
                aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
                title="Messages"
                className="relative p-2 rounded-full text-ink-300 hover:text-gold-300 hover:bg-ink-900 transition-colors"
              >
                <Mail className="w-[22px] h-[22px]" strokeWidth={1.8} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-600 text-white text-2xs font-bold flex items-center justify-center border border-ink-950">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationBell notifications={notifications} />
              <div className="relative hidden lg:block">
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); setSearchOpen(false); setUserMenuOpen(open => !open); }}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label="Account menu"
                  className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-ink-900 transition-colors"
                >
                  <Avatar name={displayName} imageUrl={avatar?.url} imagePosition={avatar?.position} className="w-10 h-10 text-lg" />
                  <ChevronDown className="w-3.5 h-3.5 text-ink-400" strokeWidth={2.4} aria-hidden="true" />
                </button>
                {userMenuOpen && (
                  <div role="menu" aria-label="Account" className="absolute right-0 top-[calc(100%+.75rem)] w-60 rounded-[14px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow) p-2 flex flex-col gap-1">
                    <AccountName name={displayName} email={user.email} avatar={avatar} onEdit={openProfile} />
                    <div className="h-px bg-ink-800" />
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-sm text-ink-300">Appearance</span>
                      <ThemeToggle />
                    </div>
                    {isStaff && (
                      <Link href="/admin/moderation" role="menuitem" onClick={closeAll} className={`${menuItemCls} flex items-center gap-2 text-red-400 light:text-red-700`}>
                        <Shield className="w-4 h-4" aria-hidden="true" /> Moderation
                      </Link>
                    )}
                    {kofiUrl && (
                      <a href={kofiUrl} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={closeAll} className={`${menuItemCls} flex items-center gap-2 text-ink-200`}>
                        <Heart className="w-4 h-4 text-gold-600" aria-hidden="true" /> Support the Realm
                      </a>
                    )}
                    {welcomeItem(menuItemCls)}
                    <button type="button" role="menuitem" onClick={openLegal} className={`${menuItemCls} text-ink-200`}>Legal and Terms</button>
                    <button type="button" role="menuitem" onClick={handleLogout} className={`${menuItemCls} text-red-400 light:text-red-700`}>Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { closeAll(); onLoginClick(); }}
              className="hidden lg:flex items-center gap-2 rounded bg-gold-700 hover:bg-gold-600 text-white text-sm font-bold px-4 py-2 transition-colors"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" /> Login
            </button>
          )}
          <button
            type="button"
            onClick={() => { setUserMenuOpen(false); setSearchOpen(false); setMobileMenuOpen(open => !open); }}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="lg:hidden p-2 rounded-full text-ink-200 hover:bg-ink-900 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-[22px] h-[22px]" aria-hidden="true" /> : <Menu className="w-[22px] h-[22px]" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* 4. Site search panel */}
      {searchOpen && (
        <div className="absolute inset-x-0 top-full bg-ink-950 border-b border-gold-900/50 shadow-(--card-shadow) px-4 md:px-6 py-4">
          <form onSubmit={handleSubmitSearch} role="search" className="max-w-3xl mx-auto flex items-center gap-3">
            <label className="relative flex items-center flex-1 min-w-0">
              <Search className="absolute left-4 w-[18px] h-[18px] text-ink-400 pointer-events-none" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search the realm: threads, characters, codex…"
                aria-label="Search the whole site"
                className="w-full bg-ink-800 border border-ink-700 rounded-full py-3 pr-4 pl-11 text-base text-ink-50 focus:border-gold-500 focus:outline-none transition-colors"
              />
            </label>
            <button type="button" onClick={() => setSearchOpen(false)} className="text-sm text-ink-400 hover:text-ink-50 transition-colors">Close</button>
          </form>
        </div>
      )}

      {/* 5. Menu below lg: the same items as the tabs and the account menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute inset-x-0 top-full bg-ink-950 border-b border-gold-900/50 shadow-(--card-shadow) p-3 flex flex-col gap-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`flex items-center gap-3 text-left rounded-lg px-3 py-3 text-base transition-colors ${isActive(item) ? 'bg-gold-900/30 text-gold-300' : 'text-ink-100 hover:bg-ink-800'}`}
            >
              <item.icon className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
              {item.label}
            </button>
          ))}
          <div className="h-px bg-ink-800 my-1" />
          {user && (
            <AccountName name={displayName} email={user.email} avatar={avatar} onEdit={openProfile} />
          )}
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-sm text-ink-300">Appearance</span>
            <ThemeToggle />
          </div>
          {isStaff && (
            <Link href="/admin/moderation" onClick={closeAll} className="flex items-center gap-2 text-sm text-red-400 light:text-red-700 hover:bg-ink-800 rounded-lg px-3 py-3 transition-colors">
              <Shield className="w-4 h-4" aria-hidden="true" /> Moderation
            </Link>
          )}
          {kofiUrl && (
            <a href={kofiUrl} target="_blank" rel="noopener noreferrer" onClick={closeAll} className="flex items-center gap-2 text-sm text-ink-200 hover:bg-ink-800 rounded-lg px-3 py-3 transition-colors">
              <Heart className="w-4 h-4 text-gold-600" aria-hidden="true" /> Support the Realm
            </a>
          )}
          {user && welcomeItem('text-left text-sm hover:bg-ink-800 rounded-lg px-3 py-3 transition-colors')}
          <button type="button" onClick={openLegal} className="text-left text-sm text-ink-200 hover:bg-ink-800 rounded-lg px-3 py-3 transition-colors">Legal and Terms</button>
          {user ? (
            <button type="button" onClick={handleLogout} className="text-left text-sm text-red-400 light:text-red-700 hover:bg-ink-800 rounded-lg px-3 py-3 transition-colors">Sign out</button>
          ) : (
            <button type="button" onClick={() => { closeAll(); onLoginClick(); }} className="flex items-center gap-2 text-left text-sm text-gold-500 hover:bg-ink-800 rounded-lg px-3 py-3 transition-colors">
              <LogIn className="w-4 h-4" aria-hidden="true" /> Login / Join
            </button>
          )}
        </div>
      )}

      <ActiveUsers isOpen={showActiveUsers} onClose={() => setShowActiveUsers(false)} />
      {profileOpen && user && (
        <ProfileEditor name={displayName} avatar={avatar} onSaveName={updateDisplayName} onSaveAvatar={updateAvatar} onClose={() => setProfileOpen(false)} />
      )}
    </header>
  );
}

export default memo(Navbar);
