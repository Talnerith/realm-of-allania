import { useState, useEffect, useRef, useMemo, memo } from 'react';
import {
  collection, query, onSnapshot, doc, setDoc,
  serverTimestamp, where, writeBatch, orderBy, limit
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import { THREAD_TAGS, MAX_TAGS, tagStyle, validTags } from '@/lib/threadTags';
import { REGION_CREST_IMG } from '@/lib/artAssets';
import {
  ChevronLeft, Search, Feather, MessageSquare, Eye, Lock, Pencil,
  ImageIcon, Loader, X, ScrollText
} from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';
import MarkdownEditor from '@/components/MarkdownEditor';
import LocationsPanel from '@/components/Forum/LocationsPanel';
import ActivityPanel from '@/components/Forum/ActivityPanel';
import TagChip from '@/components/Forum/TagChip';
import useCharacterLocations from '@/hooks/useCharacterLocations';
import useRegionNames from '@/hooks/useRegionNames';
import { hostedImageUrl } from '@/lib/imageUrls';
import { useCharacter } from '@/lib/characters';
import Avatar from '@/components/Avatar';

const cardCls = 'rounded-[14px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow)';
const millis = (ts) => ts?.toMillis?.() || 0;

// Small gold rule with a centre diamond, under the region title
const TitleRule = () => (
  <svg viewBox="0 0 240 10" aria-hidden="true" className="hidden md:block mt-1 w-60">
    <path d="M0 5h110M130 5h110" stroke="var(--color-gold-700)" strokeWidth="1" />
    <path d="M120 1l4 4-4 4-4-4z" fill="var(--color-ink-950)" stroke="var(--color-gold-500)" strokeWidth="1" />
  </svg>
);

function ThreadRow({ thread, unread, onOpen }) {
  const thumb = hostedImageUrl(thread.bannerUrl);
  const replies = Math.max(0, (thread.postCount || 1) - 1);
  const views = thread.views || 0;
  const lastBy = thread.lastPostBy || thread.createdBy || 'Unknown';
  // The last poster's character, for the portrait. Threads summarised before
  // lastPostUserId existed only identify the starter's character.
  const lastCharId = thread.lastPostCharacterId || thread.characterId;
  const lastUid = thread.lastPostUserId || (lastCharId === thread.characterId ? thread.creatorId : null);
  const lastChar = useCharacter(lastUid, lastCharId);
  const lastAt = millis(thread.lastPostAt) || millis(thread.updatedAt);
  const tags = validTags(thread.tags);

  return (
    <li className="flex items-start gap-4 md:gap-6 p-4 md:p-6 hover:bg-ink-900/50 transition-colors border-b border-ink-800 last:border-b-0">
      <div className="shrink-0 w-14 h-14 md:w-[4.75rem] md:h-[4.75rem] rounded-lg overflow-hidden border border-ink-700 bg-ink-800 flex items-center justify-center">
        {thumb
          ? <img src={thumb} alt="" className="w-full h-full object-cover" style={{ objectPosition: thread.bannerPosition || 'center' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          : <ScrollText className="w-6 h-6 text-ink-500" aria-hidden="true" />}
      </div>
      <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onOpen(thread)} className="font-serif font-semibold text-2xl leading-tight text-gold-100 hover:text-gold-400 text-left transition-colors text-pretty">
              {thread.title}
            </button>
            {unread && <span className="rounded-full bg-gold-700 text-white text-2xs font-bold uppercase tracking-wider px-2 py-0.5">New</span>}
            {thread.isLocked === true && (
              <span className="flex items-center gap-1 rounded border border-gold-700/50 bg-gold-900/30 px-1.5 py-0.5 text-2xs font-bold text-gold-400">
                <Lock className="w-3 h-3" strokeWidth={2.4} aria-hidden="true" /> Sacred Text
              </span>
            )}
            {thread.status === 'pending' && (
              <span className="rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-2xs font-semibold text-ink-300">Awaiting approval</span>
            )}
          </div>
          {thread.excerpt && <p className="text-sm leading-relaxed text-ink-300 text-pretty max-w-[40rem]">{thread.excerpt}</p>}
          {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map(t => <TagChip key={t} label={t} />)}</div>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col min-w-[3.25rem]">
            <span className="flex items-center gap-1.5 text-base text-ink-100 tabular-nums">
              <MessageSquare className="w-4 h-4 text-ink-400" aria-hidden="true" />{replies}
            </span>
            <span className="text-xs text-ink-400">{replies === 1 ? 'reply' : 'replies'}</span>
          </div>
          <div className="hidden md:block h-10 w-px bg-ink-800" />
          <div className="flex flex-col min-w-[3.25rem]">
            <span className="flex items-center gap-1.5 text-base text-ink-100 tabular-nums">
              <Eye className="w-4 h-4 text-ink-400" aria-hidden="true" />{views}
            </span>
            <span className="text-xs text-ink-400">{views === 1 ? 'view' : 'views'}</span>
          </div>
          <div className="hidden md:block h-10 w-px bg-ink-800" />
          <div className="flex items-center gap-3 min-w-0 ml-auto flex-1 md:flex-none md:w-[8.5rem]">
            <Avatar name={lastBy} imageUrl={lastChar?.imageUrl} imagePosition={lastChar?.imagePosition} className="w-10 h-10 text-lg" />
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="text-sm text-ink-300 leading-tight truncate">By <span className="text-gold-500 font-medium">{lastBy.split(' ')[0]}</span></span>
              <span className="text-xs text-ink-400 whitespace-nowrap">{timeAgo(lastAt, { short: true })}</span>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function RegionView({ region, setView, setActiveThread, onRequireAuth }) {
  const { user, userRole, readReceipts, characters, activeCharId } = useGame();
  const isMod = userRole === 'admin' || userRole === 'moderator';
  const activeChar = characters.find(c => c.id === activeCharId) || null;
  const regionName = useRegionNames();
  const { locations, activity, loading: locationsLoading, markAllRead } = useCharacterLocations(user ? activeCharId : null);

  // State
  const [threads, setThreads] = useState([]);
  const [regionMetadata, setRegionMetadata] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Moderator edit states
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isEditingBlurb, setIsEditingBlurb] = useState(false);
  const [blurbDraft, setBlurbDraft] = useState('');

  // Creating Thread
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState([]);
  const [newBanner, setNewBanner] = useState({ url: '', position: 'center' });
  const [createCodexEntry, setCreateCodexEntry] = useState(false);

  const [sessionUploads, setSessionUploads] = useState([]);
  const [cooldown, setCooldown] = useState(false);
  const [cleanupError, setCleanupError] = useState(null);
  const [createError, setCreateError] = useState(null);

  // Ref mirror so the snapshot callback sees the current edit state without
  // the main effect re-subscribing both listeners on every rename toggle
  const isEditingNameRef = useRef(isEditingName);
  useEffect(() => { isEditingNameRef.current = isEditingName; }, [isEditingName]);

  useEffect(() => {
    if (!region || region.id === undefined || !db) return;

    // 1. Metadata (name, banner, blurb)
    const metaRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata', region.id.toString());
    const unsubMeta = onSnapshot(metaRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRegionMetadata(data);
        setNameInput(prev => isEditingNameRef.current ? prev : (data.name || region.name));
      } else {
        setRegionMetadata({ bannerUrl: '' });
        setNameInput(prev => isEditingNameRef.current ? prev : region.name);
      }
    });

    // 2. Threads — security rules deny reading unapproved threads, so
    // non-mods run a status-filtered query plus (when signed in) an
    // own-threads query, merged by id. Mods query everything.
    const userId = user?.uid;
    const rid = region.id.toString();
    const threadsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads');

    const results = { approved: [], mine: [] };
    const publish = () => {
      const byId = new Map();
      [...results.approved, ...results.mine].forEach(t => byId.set(t.id, t));
      const t = Array.from(byId.values());
      t.sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt));
      setThreads(t);
    };
    const onThreadsError = (error) => console.error("Threads listener error:", error);

    const unsubs = [];
    if (isMod) {
      unsubs.push(onSnapshot(query(threadsRef, where('regionId', '==', rid), orderBy('updatedAt', 'desc'), limit(100)), (snap) => {
        results.approved = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        publish();
      }, onThreadsError));
    } else {
      unsubs.push(onSnapshot(query(threadsRef, where('regionId', '==', rid), where('status', '==', 'approved'), orderBy('updatedAt', 'desc'), limit(100)), (snap) => {
        results.approved = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        publish();
      }, onThreadsError));
      if (userId) {
        unsubs.push(onSnapshot(query(threadsRef, where('regionId', '==', rid), where('creatorId', '==', userId), orderBy('updatedAt', 'desc'), limit(100)), (snap) => {
          results.mine = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          publish();
        }, onThreadsError));
      }
    }

    return () => { unsubMeta(); unsubs.forEach(u => u()); };
  }, [region, isMod, user?.uid]);

  const metaRef = () => doc(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata', region.id.toString());

  const handleSaveBanner = async (url, position) => {
    if (!region) return;
    try {
      // CLEANUP: If there was an old banner, delete it
      const oldBannerUrl = regionMetadata?.bannerUrl;
      if (oldBannerUrl && oldBannerUrl !== url && oldBannerUrl.includes('firebasestorage')) {
        try { await deleteObject(ref(storage, oldBannerUrl)); } catch (e) { console.warn("Cleanup failed:", e); }
      }
      await setDoc(metaRef(), { bannerUrl: url, bannerPosition: position }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const handleSaveName = async () => {
    if (!region || !nameInput.trim()) return;
    try {
      await setDoc(metaRef(), { name: nameInput.trim() }, { merge: true });
      setIsEditingName(false);
    } catch (e) { console.error(e); }
  };

  const handleSaveBlurb = async () => {
    try {
      await setDoc(metaRef(), { blurb: blurbDraft.trim().slice(0, 200) }, { merge: true });
      setIsEditingBlurb(false);
    } catch (e) { console.error(e); }
  };

  const toggleTag = (label) => setNewTags(prev => (
    prev.includes(label) ? prev.filter(t => t !== label) : prev.length < MAX_TAGS ? [...prev, label] : prev
  ));

  const startCreate = () => {
    if (!user) { onRequireAuth?.(); return; }
    setCreateError(null);
    setIsCreating(true);
  };

  const handleCreateThread = async () => {
    if (!activeCharId) return setCreateError("Select a character before creating a thread.");
    if (!newTitle || newTitle.trim().length < 3) return setCreateError("Title must be at least 3 characters.");
    if (!newContent || newContent.trim().length < 10) return setCreateError("Opening post must be at least 10 characters.");
    if (cooldown) return;

    setCreateError(null);
    setCooldown(true);
    const char = characters.find(c => c.id === activeCharId);
    const currentRegionName = regionMetadata?.name || region.name;

    try {
      // ATOMIC: thread + first post + receipt (+ codex) commit together, so a
      // partial failure can't leave an empty thread behind
      const batch = writeBatch(db);

      const threadRef = doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'));
      batch.set(threadRef, {
        regionId: region.id.toString(),
        title: newTitle.trim(),
        tags: newTags,
        createdBy: char.name,
        characterId: char.id, // rules verify createdBy against this character
        creatorId: user.uid,
        bannerUrl: newBanner.url,
        bannerPosition: newBanner.position,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        postCount: 1,
        status: 'pending' // published with its first approved post
      });

      const postRef = doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'));
      batch.set(postRef, {
        threadId: threadRef.id,
        content: newContent,
        characterName: char.name,
        characterRace: char.race,
        characterClass: char.class,
        characterImageUrl: char.imageUrl || '',
        characterImagePosition: char.imagePosition || 'center',
        characterId: char.id,
        userId: user.uid,
        createdAt: serverTimestamp(),
        status: 'pending'
      });

      batch.set(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', threadRef.id), { lastRead: serverTimestamp() });

      if (createCodexEntry) {
        batch.set(doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages')), {
          title: `Lore: ${currentRegionName}`,
          category: 'Regions',
          content: `Tales from **${currentRegionName}**...\n\nStarted by ${char.name}.\n\n${newContent}`,
          gallery: [],
          relatedId: region.id.toString(),
          updatedAt: serverTimestamp(),
          updatedBy: char.name,
          creatorId: user.uid,
          lastEditorId: user.uid,
          status: 'pending'
        });
      }

      await batch.commit();
      setSessionUploads([]); // keep the uploaded thread image
      setNewTitle(''); setNewContent(''); setNewTags([]); setNewBanner({ url: '', position: 'center' }); setIsCreating(false);
    } catch (e) {
      console.error("Error creating thread:", e);
      setCreateError("Failed to create thread. Please check your connection and try again.");
    } finally {
      setTimeout(() => setCooldown(false), 2000);
    }
  };

  const handleCancelCreate = async () => {
    // Cleanup orphaned uploads
    const cleanupErrors = [];
    for (const url of sessionUploads) {
      try {
        await deleteObject(ref(storage, url));
      } catch (e) {
        console.warn("Cleanup: File already gone or failed", url, e);
        if (e.code === 'storage/unauthorized') cleanupErrors.push(url);
      }
    }
    // Non-blocking warning if cleanup failed
    if (cleanupErrors.length > 0) {
      setCleanupError(`Failed to cleanup ${cleanupErrors.length} temporary image(s). They may be removed later.`);
      setTimeout(() => setCleanupError(null), 5000);
    }
    setSessionUploads([]);
    setNewTitle(''); setNewContent(''); setNewTags([]); setNewBanner({ url: '', position: 'center' });
    setCreateError(null);
    setIsCreating(false);
  };

  const openThread = (thread) => {
    if (!thread) return;
    setActiveThread(thread);
    setView('thread');
  };

  const q = searchQuery.trim().toLowerCase();
  const visibleThreads = useMemo(() => (q
    ? threads.filter(t => [t.title, t.excerpt, t.lastPostBy, t.createdBy, ...(t.tags || [])].filter(Boolean).join(' ').toLowerCase().includes(q))
    : threads), [threads, q]);

  if (!region || region.id === undefined) return <div className="h-full flex items-center justify-center bg-ink-950 text-ink-500"><Loader className="w-8 h-8 animate-spin text-gold-500" /></div>;

  const bannerUrl = hostedImageUrl(regionMetadata?.bannerUrl) || null;
  const bannerPos = regionMetadata?.bannerPosition || 'center';
  const displayName = regionMetadata?.name || region.name;
  const blurb = regionMetadata?.blurb || '';
  const showPanels = !!user;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-ink-950">
      {/* Banner */}
      <section className="relative shrink-0 overflow-hidden border-b border-gold-900/50 bg-ink-900 h-[clamp(12rem,18vw+4rem,17rem)]">
        {bannerUrl && (
          <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: bannerPos }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        )}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,var(--color-ink-950)_0%,color-mix(in_oklab,var(--color-ink-950)_80%,transparent)_30%,transparent_62%),linear-gradient(0deg,color-mix(in_oklab,var(--color-ink-950)_55%,transparent),transparent_40%)]" />
        <div className="absolute inset-0 flex items-center px-4 md:px-8 pt-3">
          <div className="flex items-center gap-4 md:gap-6 min-w-0 max-w-[44rem]">
            <img src={REGION_CREST_IMG.src} alt="" className="shrink-0 w-auto block h-[clamp(4.5rem,4vw+3rem,110px)] drop-shadow-[0_10px_18px_rgb(0_0_0/.55)]" />
            <div className="flex flex-col gap-2 min-w-0">
              {isEditingName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} aria-label="Region name" maxLength={60} autoFocus
                    className="flex-1 min-w-0 bg-ink-800 border border-ink-700 rounded px-3 py-2 font-serif text-3xl font-bold text-ink-50 focus:border-gold-500 focus:outline-none" />
                  <button type="button" onClick={handleSaveName} className="bg-gold-700 hover:bg-gold-600 text-white rounded px-4 py-2 text-sm font-bold transition-colors">Save</button>
                  <button type="button" onClick={() => setIsEditingName(false)} className="text-sm text-ink-300 hover:text-ink-50 px-2 py-2 transition-colors">Cancel</button>
                </div>
              ) : (
                <h1 className="font-serif font-bold text-gold-100 leading-none text-4xl md:text-6xl text-balance [text-shadow:0_2px_18px_rgb(0_0_0/.35)]">{displayName}</h1>
              )}
              {isEditingBlurb ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input value={blurbDraft} onChange={(e) => setBlurbDraft(e.target.value)} aria-label="Region blurb" placeholder="A line about this region…" maxLength={200} autoFocus
                    className="flex-1 min-w-0 bg-ink-800 border border-ink-700 rounded px-3 py-2 font-serif italic text-lg text-ink-50 focus:border-gold-500 focus:outline-none" />
                  <button type="button" onClick={handleSaveBlurb} className="bg-gold-700 hover:bg-gold-600 text-white rounded px-4 py-2 text-sm font-bold transition-colors">Save</button>
                  <button type="button" onClick={() => setIsEditingBlurb(false)} className="text-sm text-ink-300 hover:text-ink-50 px-2 py-2 transition-colors">Cancel</button>
                </div>
              ) : (blurb || isMod) && (
                <div className="flex items-center gap-2 min-w-0">
                  {blurb && <p className="font-serif italic text-ink-100 text-lg md:text-xl min-w-0 text-pretty">{blurb}</p>}
                  {isMod && (
                    <button type="button" onClick={() => { setBlurbDraft(blurb); setIsEditingBlurb(true); }} title="Edit region blurb" aria-label="Edit region blurb"
                      className="flex items-center gap-1.5 shrink-0 rounded-full bg-ink-950/50 px-2 py-1 text-xs text-ink-200 hover:text-gold-300 transition-colors">
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />{!blurb && <span>Add a blurb</span>}
                    </button>
                  )}
                </div>
              )}
              <TitleRule />
            </div>
          </div>
        </div>
        {isMod && !isEditingName && (
          <div className="absolute top-3 right-3 flex gap-2">
            <button type="button" onClick={() => setIsEditingName(true)} className="flex items-center gap-1.5 rounded-full bg-ink-950/70 border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:text-gold-300 hover:border-gold-700 transition-colors">
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Rename
            </button>
            <button type="button" onClick={() => setIsEditingBanner(v => !v)} aria-expanded={isEditingBanner} className="flex items-center gap-1.5 rounded-full bg-ink-950/70 border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:text-gold-300 hover:border-gold-700 transition-colors">
              <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> Banner
            </button>
          </div>
        )}
      </section>

      {isMod && isEditingBanner && (
        <div className="bg-ink-900 border-b border-gold-900/30 p-4">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm text-gold-500 font-bold">Region banner</h2>
              <button type="button" onClick={() => setIsEditingBanner(false)} aria-label="Close banner editor" className="text-ink-400 hover:text-ink-50"><X className="w-4 h-4" /></button>
            </div>
            <ImageUploader initialUrl={bannerUrl} initialPosition={bannerPos} folder="region_banners" shape="banner" onImageChanged={handleSaveBanner} />
          </div>
        </div>
      )}

      <div className="w-full px-3 md:px-6 pt-8 pb-32 flex flex-col lg:flex-row lg:flex-wrap min-[1400px]:flex-nowrap lg:items-start gap-6">
        {showPanels && (
          <aside className="hidden lg:flex flex-col gap-4 shrink-0 w-60" aria-label="Character locations">
            <LocationsPanel character={activeChar} locations={locations} loading={locationsLoading} regionName={regionName} onOpenThread={openThread} />
          </aside>
        )}

        <main className="flex-1 min-w-0 flex flex-col gap-4">
          {showPanels && (
            <LocationsPanel collapsible className="lg:hidden" character={activeChar} locations={locations} loading={locationsLoading} regionName={regionName} onOpenThread={openThread} />
          )}

          {cleanupError && (
            <div className="p-3 bg-gold-900/30 border border-gold-700/50 rounded-lg flex items-center gap-2 text-gold-300 text-sm" role="status">
              <span className="flex-1">{cleanupError}</span>
              <button type="button" onClick={() => setCleanupError(null)} aria-label="Dismiss" className="text-gold-500 hover:text-gold-300"><X className="w-4 h-4" /></button>
            </div>
          )}

          <div className={`${cardCls} p-3 flex flex-col md:flex-row md:items-center gap-3`}>
            <nav aria-label="Breadcrumb" className="flex-1 min-w-0 flex items-center gap-2 px-1 text-sm">
              <ChevronLeft className="w-4 h-4 text-ink-400 shrink-0" aria-hidden="true" />
              <button type="button" onClick={() => setView('map')} className="text-ink-300 hover:text-gold-500 shrink-0 transition-colors">World Map</button>
              <span className="text-ink-600" aria-hidden="true">/</span>
              <span className="text-ink-50 font-medium truncate" aria-current="page">{displayName}</span>
            </nav>
            <div className="flex items-center gap-3">
              <label className="relative flex items-center flex-1 min-w-0 md:max-w-80">
                <Search className="absolute left-3 w-4 h-4 text-ink-400 pointer-events-none" aria-hidden="true" />
                <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search this location…" aria-label="Search threads in this location"
                  className="w-full bg-ink-800 border border-ink-700 rounded-full py-2 pl-9 pr-4 text-sm text-ink-200 focus:border-gold-500 focus:outline-none transition-colors" />
              </label>
              <button type="button" onClick={startCreate} className="flex items-center gap-2 shrink-0 bg-gold-700 hover:bg-gold-600 text-white rounded px-4 py-2 text-sm font-bold transition-colors">
                <Feather className="w-4 h-4" aria-hidden="true" /><span>New thread</span>
              </button>
            </div>
          </div>

          {isCreating && (
            <section className={`rounded-[14px] bg-(color:--card-bg) border border-gold-900/50 shadow-(--card-shadow) p-4 md:p-6 flex flex-col gap-4`} aria-label="New thread">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-2xl text-gold-100">New thread in {displayName}</h2>
                <span className="text-xs text-ink-400">
                  {activeChar ? <>Writing as <span className="text-gold-500 font-medium">{activeChar.name}</span></> : 'Choose a character in the roster first'}
                </span>
              </div>
              <input value={newTitle} onChange={(e) => { setNewTitle(e.target.value); setCreateError(null); }} placeholder="Thread title" aria-label="Thread title" maxLength={140}
                className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-2 font-serif text-xl text-ink-50 focus:border-gold-500 focus:outline-none transition-colors" />
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-widest text-ink-400">Tags · up to {MAX_TAGS}</span>
                <div className="flex flex-wrap gap-2">
                  {THREAD_TAGS.map(label => {
                    const on = newTags.includes(label);
                    return (
                      <button key={label} type="button" onClick={() => toggleTag(label)} aria-pressed={on}
                        disabled={!on && newTags.length >= MAX_TAGS}
                        className="rounded border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-40"
                        style={on ? tagStyle(label) : { background: 'transparent', borderColor: 'var(--color-ink-700)', color: 'var(--color-ink-300)' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <MarkdownEditor
                value={newContent}
                onChange={(e) => { setNewContent(e.target.value); setCreateError(null); }}
                placeholder="Open the tale…"
                onPost={handleCreateThread}
                submitLabel="Create thread"
                isSubmitting={cooldown}
                isSubmitDisabled={!newTitle.trim() || !newContent.trim()}
              />
              <details className="rounded border border-ink-800 bg-ink-950/40">
                <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-widest text-ink-400">Thread image and codex (optional)</summary>
                <div className="p-3 flex flex-col gap-3">
                  <ImageUploader folder="thread_banners" shape="banner" onImageChanged={(url, pos) => {
                    setNewBanner({ url, position: pos });
                    setSessionUploads(prev => [...prev, url]);
                  }} />
                  <label className="flex items-center gap-2 text-sm text-ink-300 cursor-pointer">
                    <input type="checkbox" checked={createCodexEntry} onChange={(e) => setCreateCodexEntry(e.target.checked)} className="w-4 h-4 accent-gold-600" />
                    Add this lore to the Codex
                  </label>
                </div>
              </details>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {createError && <p className="text-xs text-red-400" role="alert">{createError}</p>}
                <p className="text-xs text-ink-400">New threads appear after a moderator approves them.</p>
                <button type="button" onClick={handleCancelCreate} className="text-sm text-ink-400 hover:text-ink-50 transition-colors">Cancel</button>
              </div>
            </section>
          )}

          <section className={`${cardCls} overflow-hidden`} aria-label="Threads">
            {visibleThreads.length > 0 ? (
              <ul>
                {visibleThreads.map(thread => (
                  <ThreadRow
                    key={thread.id}
                    thread={thread}
                    unread={!!user && millis(thread.updatedAt) > (readReceipts?.[thread.id] || 0)}
                    onOpen={openThread}
                  />
                ))}
              </ul>
            ) : (
              <div className="px-6 py-12 text-center flex flex-col gap-2">
                <p className="font-serif text-2xl text-ink-300">{q ? `No threads match “${searchQuery.trim()}”` : 'No threads here yet'}</p>
                <p className="text-sm text-ink-400">{q ? 'Try a title, tag or character name.' : `Start the first tale in ${displayName}.`}</p>
              </div>
            )}
          </section>
        </main>

        {showPanels && (
          <aside className="flex flex-col gap-4 shrink-0 w-full min-[1400px]:w-64" aria-label="Recent activity">
            <ActivityPanel character={activeChar} activity={activity} onOpenThread={openThread} onMarkAllRead={markAllRead} />
          </aside>
        )}
      </div>
    </div>
  );
}

export default memo(RegionView);
