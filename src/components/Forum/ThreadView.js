import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
    collection, query, onSnapshot, doc, setDoc, getDoc,
    serverTimestamp, updateDoc, deleteDoc, getDocs, writeBatch, where, increment, orderBy
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import { validTags } from '@/lib/threadTags';
import { REGION_CREST_IMG } from '@/lib/artAssets';
import {
    ChevronRight, ChevronLeft, ChevronDown, User, Clock, MessageCircle, Eye, CalendarDays, MapPin,
    Lock, Unlock, Trash2, ImageIcon, X, Loader, Shield, ShieldAlert, Gavel, Feather
} from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';
import MarkdownEditor from '@/components/MarkdownEditor';
import PostItem from '@/components/Forum/PostItem';
import LocationsPanel from '@/components/Forum/LocationsPanel';
import ActivityPanel from '@/components/Forum/ActivityPanel';
import TagChip from '@/components/Forum/TagChip';
import useCharacterLocations from '@/hooks/useCharacterLocations';
import useRegionNames from '@/hooks/useRegionNames';
import useMediaQuery from '@/hooks/useMediaQuery';
import { hostedImageUrl } from '@/lib/imageUrls';
import { useCharacter } from '@/lib/characters';
import Avatar from '@/components/Avatar';

export const POSTS_PER_PAGE = 8;

const cardCls = 'rounded-[14px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow)';
const millis = (ts) => ts?.toMillis?.() || 0;
const firstName = (name = '') => name.split(' ')[0];
const dateLabel = (ts) => (millis(ts) ? new Date(millis(ts)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

// Placeholder post while the thread loads
const PostSkeleton = () => (
    <div className={`${cardCls} flex flex-col md:flex-row motion-safe:animate-skeleton`} aria-hidden="true">
        <div className="hidden md:flex flex-col items-center gap-3 w-48 p-5 border-r border-ink-800">
            <div className="w-24 h-24 rounded-full bg-ink-800" />
            <div className="h-3 w-24 rounded bg-ink-800" />
        </div>
        <div className="flex-1 p-4 md:p-6 space-y-3">
            <div className="h-3 w-32 rounded bg-ink-800" />
            <div className="h-4 w-full rounded bg-ink-800" />
            <div className="h-4 w-11/12 rounded bg-ink-800" />
            <div className="h-4 w-2/3 rounded bg-ink-800" />
        </div>
    </div>
);

// Page buttons; long threads show the first, last and nearby pages
function Pager({ page, pages, onPage, label }) {
    const nums = [];
    for (let i = 1; i <= pages; i++) {
        if (pages <= 7 || i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
        else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    const btn = 'min-w-8 h-8 px-2 rounded flex items-center justify-center text-sm tabular-nums transition-colors';
    return (
        <nav aria-label={label} className="flex items-center gap-1">
            <button type="button" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page"
                className={`${btn} ${page === 1 ? 'text-ink-600' : 'text-ink-300 hover:bg-ink-800 hover:text-gold-300'}`}>
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.4} aria-hidden="true" />
            </button>
            {nums.map((n, i) => n === '…'
                ? <span key={`gap-${i}`} className="px-1 text-ink-500" aria-hidden="true">…</span>
                : (
                    <button key={n} type="button" onClick={() => onPage(n)} aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined}
                        className={`${btn} ${n === page ? 'bg-gold-700 text-white font-bold' : 'border border-ink-700 text-ink-200 hover:border-gold-700 hover:text-gold-300'}`}>
                        {n}
                    </button>
                ))}
            <button type="button" onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Next page"
                className={`${btn} ${page === pages ? 'text-ink-600' : 'text-ink-300 hover:bg-ink-800 hover:text-gold-300'}`}>
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.4} aria-hidden="true" />
            </button>
        </nav>
    );
}

// Small gold rule with a centre diamond (fixed colours: it sits on the banner)
const BannerRule = () => (
    <svg viewBox="0 0 240 10" aria-hidden="true" className="hidden md:block mt-1 w-60">
        <path d="M0 5h110M130 5h110" stroke="var(--a-600)" strokeWidth="1" />
        <path d="M120 1l4 4-4 4-4-4z" fill="rgb(8 10 15)" stroke="var(--a-400)" strokeWidth="1" />
    </svg>
);
const PanelRule = ({ edge }) => (
    <svg viewBox="0 0 60 10" aria-hidden="true" className={`absolute w-15 left-[calc(50%-1.875rem)] ${edge === 'top' ? '-top-[5px]' : '-bottom-[5px]'}`}>
        <path d="M0 5h22M38 5h22" stroke="var(--color-gold-700)" strokeWidth="1" />
        <path d="M30 1l4 4-4 4-4-4z" fill="var(--color-ink-950)" stroke="var(--color-gold-500)" strokeWidth="1" />
    </svg>
);

function ThreadInfo({ thread, creator, regionLabel, replies, onJumpLatest, onOpenRegion, collapsible }) {
    const tags = validTags(thread.tags);
    const views = thread.views || 0;
    const lastBy = thread.lastPostBy || thread.createdBy;
    const rows = [
        [User, 'Created by', (
            <span key="by" className="flex items-center gap-2 min-w-0">
                <Avatar name={thread.createdBy} imageUrl={creator?.imageUrl} imagePosition={creator?.imagePosition} className="w-5 h-5 text-xs" />
                <span className="truncate">{thread.createdBy || 'Unknown'}</span>
            </span>
        )],
        [CalendarDays, 'Posted', <span key="posted" title={dateLabel(thread.createdAt)}>{timeAgo(thread.createdAt)}</span>],
        [MessageCircle, 'Replies', replies],
        [Eye, 'Views', views],
        [Clock, 'Last reply', lastBy ? (
            <>{timeAgo(millis(thread.lastPostAt) || millis(thread.updatedAt))}<br /><span className="text-ink-400">by </span>
                <button type="button" onClick={onJumpLatest} className="text-gold-500 hover:text-gold-300 transition-colors">{firstName(lastBy)}</button></>
        ) : '—'],
        [MapPin, 'Region', <button key="r" type="button" onClick={onOpenRegion} className="text-gold-500 hover:text-gold-300 text-left transition-colors">{regionLabel}</button>],
    ];
    const tagList = tags.length > 0 && (
        <div className="flex flex-wrap gap-2">{tags.map(t => <TagChip key={t} label={t} pill />)}</div>
    );
    const details = (
        <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-3 text-sm">
                {rows.map(([Icon, k, v]) => (
                    <div key={k} className="contents">
                        <Icon className="w-4 h-4 text-gold-500 mt-0.5" aria-hidden="true" />
                        <dt className="text-ink-400">{k}</dt>
                        <dd className="text-ink-50 tabular-nums min-w-0">{v}</dd>
                    </div>
                ))}
            </dl>
            {tags.length > 0 && (
                <>
                    <div className="h-px bg-ink-800" />
                    <div className="flex flex-col gap-3">
                        <h3 className="font-serif text-lg text-gold-100">Tags</h3>
                        {tagList}
                    </div>
                </>
            )}
        </div>
    );

    if (collapsible) {
        return (
            <details className={`relative ${cardCls} p-5 group/info`} aria-label="Thread information">
                <PanelRule edge="top" />
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex flex-col gap-3">
                    <span className="flex items-center gap-2">
                        <span className="font-serif text-xl text-gold-100 flex-1">Thread Information</span>
                        <span className="text-xs text-ink-400">{replies} {replies === 1 ? 'reply' : 'replies'} · {views} views</span>
                        <ChevronDown className="w-4 h-4 text-ink-400 shrink-0" aria-hidden="true" />
                    </span>
                    <span className="group-open/info:hidden">{tagList}</span>
                </summary>
                <div className="pt-4">{details}</div>
                <PanelRule edge="bottom" />
            </details>
        );
    }
    return (
        <section className={`relative ${cardCls} p-5 flex flex-col gap-4`} aria-label="Thread information">
            <PanelRule edge="top" />
            <h2 className="font-serif text-xl text-gold-100">Thread Information</h2>
            {details}
            <PanelRule edge="bottom" />
        </section>
    );
}

function ThreadView({ thread, setView, region, onOpenCodex, onNavigateToRegion, onMessageUser, onRequireAuth, onWikiLink, onOpenThread }) {
    const { user, userRole, characters, activeCharId } = useGame();
    const wide = useMediaQuery('(min-width: 1280px)');
    const regionName = useRegionNames();
    // null until the first snapshot arrives (loading skeleton)
    const [posts, setPosts] = useState(null);
    const [liveThread, setLiveThread] = useState(thread);
    const [regionMeta, setRegionMeta] = useState(null);
    const [page, setPage] = useState(1);
    const [scrollTarget, setScrollTarget] = useState(null);
    const [replyOpen, setReplyOpen] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [cooldown, setCooldown] = useState(false);
    const [replyError, setReplyError] = useState(null);

    const [isEditingBanner, setIsEditingBanner] = useState(false);
    const [editingPostId, setEditingPostId] = useState(null);
    const [editPostContent, setEditPostContent] = useState('');

    // Admin helpers
    const [copiedUserId, setCopiedUserId] = useState(null);
    const [managingUser, setManagingUser] = useState(null);
    const [managingUserRole, setManagingUserRole] = useState(null);

    const scrollContainerRef = useRef(null);

    const isAdmin = userRole === 'admin';
    const isAdminOrMod = userRole === 'admin' || userRole === 'moderator';
    const isThreadOwner = user && liveThread && user.uid === liveThread.creatorId;
    const isThreadLocked = liveThread?.isLocked === true;
    const canEditBanner = isAdminOrMod || (isThreadOwner && !isThreadLocked);
    const activeChar = characters.find(c => c.id === activeCharId) || null;
    // The thread starter's character, for its portrait in the header and info box
    const creator = useCharacter(liveThread?.creatorId, liveThread?.characterId);
    const { locations, activity, loading: locationsLoading, markAllRead } = useCharacterLocations(user ? activeCharId : null);

    // 1. Mark as read on entry
    useEffect(() => {
        if (user && thread) {
            setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', thread.id), {
                lastRead: serverTimestamp()
            }, { merge: true });
        }
    }, [user, thread]);

    // 2. Fetch thread and posts
    useEffect(() => {
        if (!thread) return;

        const unsubThread = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), (snap) => {
            if (snap.exists()) { setLiveThread({ id: snap.id, ...snap.data() }); }
            else { setView('region'); }
        }, (error) => {
            // Permission denied (e.g. thread was rejected while viewing) — leave
            console.error("Thread listener error:", error);
            setView('region');
        });

        // Posts — security rules deny reading unapproved posts, so non-mods run
        // a status-filtered query plus (when signed in) an own-posts query,
        // merged by id. Mods query everything.
        const postsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts');
        const results = { approved: [], mine: [], ready: false };
        // Wait for the main query, so an early own-posts snapshot doesn't flash the empty state
        const publish = () => {
            if (!results.ready) return;
            const byId = new Map();
            [...results.approved, ...results.mine].forEach(p => byId.set(p.id, p));
            const p = Array.from(byId.values());
            p.sort((a, b) => (millis(a.createdAt) || Infinity) - (millis(b.createdAt) || Infinity));
            setPosts(p);
        };
        const onPostsError = (error) => {
            console.error("Error fetching posts:", error);
            setPosts((prev) => prev ?? []);
        };

        const unsubs = [unsubThread];
        if (isAdminOrMod) {
            unsubs.push(onSnapshot(
                query(postsRef, where('threadId', '==', thread.id), orderBy('createdAt', 'asc')),
                (snap) => { results.approved = snap.docs.map(d => ({ id: d.id, ...d.data() })); results.ready = true; publish(); },
                onPostsError
            ));
        } else {
            unsubs.push(onSnapshot(
                query(postsRef, where('threadId', '==', thread.id), where('status', '==', 'approved'), orderBy('createdAt', 'asc')),
                (snap) => { results.approved = snap.docs.map(d => ({ id: d.id, ...d.data() })); results.ready = true; publish(); },
                onPostsError
            ));
            if (user) {
                unsubs.push(onSnapshot(
                    query(postsRef, where('threadId', '==', thread.id), where('userId', '==', user.uid), orderBy('createdAt', 'asc')),
                    (snap) => { results.mine = snap.docs.map(d => ({ id: d.id, ...d.data() })); publish(); },
                    onPostsError
                ));
            }
        }

        return () => { unsubs.forEach(u => u()); };
    }, [thread, setView, isAdminOrMod, user]);

    // 3. Region banner fallback and crest line
    const regionId = liveThread?.regionId ?? region?.id;
    useEffect(() => {
        if (!db || regionId === undefined || regionId === null) return;
        return onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata', String(regionId)),
            (snap) => setRegionMeta(snap.exists() ? snap.data() : {}), () => {});
    }, [regionId]);

    // 4. One view per thread per session for signed-in players
    const threadId = liveThread?.id;
    const threadPublished = (liveThread?.status ?? 'approved') === 'approved';
    useEffect(() => {
        if (!user || !db || !threadId || !threadPublished) return;
        const key = `allania-viewed:${threadId}`;
        try {
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, '1');
        } catch { /* storage blocked: count this visit */ }
        updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', threadId), { views: increment(1) }).catch(() => {});
    }, [user, threadId, threadPublished]);

    // Admin role fetcher
    useEffect(() => {
        if (!managingUser) return;
        let live = true;
        getDoc(doc(db, 'artifacts', APP_ID, 'users', managingUser.id, 'settings', 'account'))
            .then(snap => { if (live) setManagingUserRole(snap.exists() ? (snap.data().role || 'user') : 'user'); })
            .catch(e => { console.error("Error fetching role:", e); if (live) setManagingUserRole('error'); });
        return () => { live = false; };
    }, [managingUser]);

    const total = posts?.length || 0;
    const pages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
    const currentPage = Math.min(page, pages);
    const pagePosts = useMemo(
        () => (posts || []).slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE),
        [posts, currentPage]
    );

    // Scroll a post into view once its page has rendered
    useEffect(() => {
        if (!scrollTarget) return;
        const el = scrollContainerRef.current?.querySelector(`#post-${scrollTarget}`);
        if (el) {
            el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
            setScrollTarget(null);
        }
    }, [scrollTarget, pagePosts]);

    const goToPost = useCallback((n) => {
        setPage(Math.max(1, Math.ceil(n / POSTS_PER_PAGE)));
        setScrollTarget(n);
    }, []);

    const changePage = (p) => {
        setPage(Math.min(Math.max(1, p), pages));
        scrollContainerRef.current?.querySelector('[data-thread-top]')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    };

    const handleReply = useCallback(async () => {
        if (!user) return onRequireAuth();
        if (!activeCharId) return setReplyError("Select a character from the roster before posting.");
        if (replyContent.trim().length < 10) return setReplyError("Post must be at least 10 characters.");
        if (cooldown) return;

        setReplyError(null);
        setIsSending(true);
        const char = characters.find(c => c.id === activeCharId);

        try {
            const batch = writeBatch(db);

            // 1. Create Post
            const postRef = doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'));
            batch.set(postRef, {
                threadId: thread.id,
                content: replyContent,
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

            // 2. Update Thread Metadata (atomic increment)
            batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), {
                updatedAt: serverTimestamp(),
                postCount: increment(1)
            });

            // 3. Update User Read Receipt
            batch.set(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', thread.id), { lastRead: serverTimestamp() }, { merge: true });

            await batch.commit();

            setReplyContent('');
            setReplyOpen(false);
            goToPost(total + 1);
            setCooldown(true);
            setTimeout(() => setCooldown(false), 2000);
        } catch (e) {
            console.error(e);
            setReplyError("Failed to post reply. Please check your connection and try again.");
        } finally {
            setIsSending(false);
        }
    }, [user, activeCharId, replyContent, cooldown, characters, thread, onRequireAuth, goToPost, total]);

    const handleEditPostStart = useCallback((post) => {
        if (isThreadLocked && !isAdminOrMod) {
            alert("This thread is sealed as a Sacred Text. Only moderators can edit posts.");
            return;
        }
        if (post.characterId !== activeCharId) { alert(`You must be playing as ${post.characterName} to edit this post content.`); return; }
        setEditingPostId(post.id);
        setEditPostContent(post.content);
    }, [activeCharId, isThreadLocked, isAdminOrMod]);

    const handleEditPostSave = useCallback(async () => {
        if (!editingPostId || !editPostContent.trim()) return;
        if (editPostContent.length < 10) return alert("Content too short.");
        try {
            // Non-mod edits go back to 'pending' (the rules require it) so the
            // moderation function checks the new text before others see it
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'posts', editingPostId), {
                content: editPostContent,
                isEdited: true,
                editedAt: serverTimestamp(),
                ...(!isAdminOrMod && { status: 'pending' })
            });
            setEditingPostId(null); setEditPostContent('');
        } catch (e) { console.error(e); }
    }, [editingPostId, editPostContent, isAdminOrMod]);

    const handleEditCancel = useCallback(() => {
        setEditingPostId(null);
        setEditPostContent('');
    }, []);

    const handleBannerUpdate = useCallback(async (url, position) => {
        try {
            if (liveThread.bannerUrl && liveThread.bannerUrl !== url && liveThread.bannerUrl.includes('firebasestorage')) {
                try { await deleteObject(ref(storage, liveThread.bannerUrl)); } catch (e) { console.warn("Cleanup failed (might not be owner):", e); }
            }
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), { bannerUrl: url, bannerPosition: position });
        } catch (e) { console.error(e); }
    }, [liveThread, thread]);

    const handleDeletePost = useCallback(async (postId) => {
        if (!isAdminOrMod) { alert("Insufficient permissions."); return; }
        if (!window.confirm("Delete this post? This action is reserved for Moderators.")) return;
        try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'posts', postId)); } catch (e) { console.error(e); }
    }, [isAdminOrMod]);

    const handleDeleteThread = async () => {
        if (!isAdminOrMod) { alert("Insufficient permissions."); return; }
        if (!window.confirm("Delete this ENTIRE thread?")) return;
        try {
            // Posts first (thread doc last, so a failure doesn't orphan
            // unreachable posts), chunked under Firestore's 500-op batch limit
            const snapshot = await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), where("threadId", "==", thread.id)));
            const docs = snapshot.docs;
            for (let i = 0; i < docs.length; i += 450) {
                const batch = writeBatch(db);
                docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
                await batch.commit();
            }
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id));
            if (liveThread.bannerUrl && liveThread.bannerUrl.includes('firebasestorage')) {
                try { await deleteObject(ref(storage, liveThread.bannerUrl)); } catch (e) { console.warn("Banner cleanup failed:", e); }
            }
            setView('region');
        } catch (e) { console.error(e); }
    };

    const handleToggleLock = async () => {
        if (!isAdminOrMod) { alert("Insufficient permissions."); return; }
        const newLockState = !isThreadLocked;
        if (!window.confirm(newLockState
            ? 'Seal this thread as a Sacred Text? Players will not be able to reply or edit their posts.'
            : 'Unseal this thread? Players will be able to reply and edit their posts again.')) return;
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), {
                isLocked: newLockState,
                lockedAt: newLockState ? serverTimestamp() : null,
                lockedBy: newLockState ? user.uid : null
            });
        } catch (e) {
            console.error(e);
            alert("Failed to update lock status.");
        }
    };

    const handleCopyUserId = useCallback((id) => {
        navigator.clipboard?.writeText(id);
        setCopiedUserId(id);
        setTimeout(() => setCopiedUserId(null), 2000);
    }, []);

    const handleManageUser = useCallback((userObj) => {
        setManagingUserRole(null);
        setManagingUser(userObj);
    }, []);

    const handleUpdateRole = async (newRole) => {
        if (!managingUser) return;
        if (!isAdmin) { alert("Insufficient permissions."); return; }
        if (!window.confirm(`Are you sure you want to set ${managingUser.name || 'this user'} to ${newRole.toUpperCase()}?`)) return;
        try {
            await setDoc(doc(db, 'artifacts', APP_ID, 'users', managingUser.id, 'settings', 'account'), { role: newRole }, { merge: true });
            alert(`Success! User is now a ${newRole}.`); setManagingUser(null);
        } catch (e) { console.error(e); alert("Failed to update role."); }
    };

    const openRegion = () => {
        if (region && String(region.id) === String(liveThread?.regionId ?? region.id)) setView('region');
        else onNavigateToRegion?.({ id: liveThread?.regionId, name: regionName(liveThread?.regionId) });
    };
    const openThread = (t) => {
        if (!t || t.id === thread?.id) return;
        onOpenThread?.(t);
    };

    const banner = hostedImageUrl(liveThread?.bannerUrl) || hostedImageUrl(regionMeta?.bannerUrl) || null;
    const bannerPos = hostedImageUrl(liveThread?.bannerUrl) ? (liveThread?.bannerPosition || 'center') : (regionMeta?.bannerPosition || 'center');
    const titleKnown = Boolean(liveThread?.title);
    const regionLabel = regionMeta?.name || region?.name || regionName(regionId);
    const replies = Math.max(0, (liveThread?.postCount || total || 1) - 1);
    const views = liveThread?.views || 0;
    const canReply = !isThreadLocked || isAdminOrMod;
    const firstShown = (currentPage - 1) * POSTS_PER_PAGE + 1;

    return (
        <div ref={scrollContainerRef} className="h-full overflow-y-auto custom-scrollbar bg-ink-950">
            {/* Banner */}
            <section className="relative overflow-hidden border-b border-gold-900/50 bg-[rgb(8_10_15)] h-[clamp(14rem,56vw,18rem)] md:h-[clamp(16rem,25vw,26rem)]">
                {banner && <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: bannerPos }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgb(8_10_15/.92)_0%,rgb(8_10_15/.72)_40%,rgb(8_10_15/.15)_78%),linear-gradient(0deg,rgb(8_10_15/.55),transparent_55%)]" />
                <div className="absolute inset-0 flex items-center px-4 md:px-8 lg:px-12">
                    <div className="flex items-center gap-4 md:gap-6 min-w-0 max-w-[54rem]">
                        <img src={REGION_CREST_IMG.src} alt="" className="shrink-0 w-auto block h-[clamp(4.5rem,4vw+3rem,112px)] drop-shadow-[0_10px_18px_rgb(0_0_0/.5)]" />
                        <div className="flex flex-col gap-2 min-w-0">
                            <nav aria-label="Breadcrumb">
                                <ol className="flex flex-wrap items-center gap-2 text-sm">
                                    <li className="flex items-center gap-2">
                                        <button type="button" onClick={() => setView('map')} className="text-white/80 hover:text-(color:--a-200) transition-colors">World Map</button>
                                        <ChevronRight className="w-3 h-3 text-white/50" strokeWidth={2.4} aria-hidden="true" />
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <button type="button" onClick={openRegion} className="text-white/80 hover:text-(color:--a-200) transition-colors">{regionLabel || 'Region'}</button>
                                        <ChevronRight className="w-3 h-3 text-white/50" strokeWidth={2.4} aria-hidden="true" />
                                    </li>
                                    <li aria-current="page" className="truncate max-w-[22rem] text-(color:--a-300)">{liveThread?.title}</li>
                                </ol>
                            </nav>
                            {titleKnown ? (
                                <h1 className="font-serif font-bold leading-none text-3xl md:text-5xl text-(color:--a-100) text-balance [text-shadow:0_2px_18px_rgb(0_0_0/.4)]">{liveThread.title}</h1>
                            ) : (
                                <div className="h-10 md:h-12 w-2/3 max-w-md rounded-lg bg-white/10 motion-safe:animate-skeleton" aria-hidden="true" />
                            )}
                            {liveThread?.excerpt && <p className="font-serif italic text-white text-lg md:text-xl text-pretty line-clamp-2">{liveThread.excerpt}</p>}
                            <BannerRule />
                        </div>
                    </div>
                </div>
                {(canEditBanner || isAdminOrMod) && (
                    <div className="absolute top-3 right-3 flex gap-2">
                        {isThreadLocked && (
                            <span className="flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-3 py-1.5 text-xs text-(color:--a-300)">
                                <Lock className="w-3.5 h-3.5" aria-hidden="true" /> Sacred Text
                            </span>
                        )}
                        {canEditBanner && (
                            <button type="button" onClick={() => setIsEditingBanner(v => !v)} aria-expanded={isEditingBanner} className="flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:text-(color:--a-300) transition-colors">
                                <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> Banner
                            </button>
                        )}
                        {isAdminOrMod && (
                            <button type="button" onClick={handleToggleLock} className="flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:text-(color:--a-300) transition-colors">
                                {isThreadLocked ? <Unlock className="w-3.5 h-3.5" aria-hidden="true" /> : <Lock className="w-3.5 h-3.5" aria-hidden="true" />}
                                {isThreadLocked ? 'Unseal' : 'Seal'}
                            </button>
                        )}
                        {isAdminOrMod && (
                            <button type="button" onClick={handleDeleteThread} className="flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-3 py-1.5 text-xs text-red-300 hover:text-red-200 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete thread
                            </button>
                        )}
                    </div>
                )}
            </section>

            {isEditingBanner && (
                <div className="bg-ink-900 border-b border-gold-900/30 p-4 relative z-30">
                    <div className="max-w-4xl mx-auto space-y-2">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-gold-500 font-bold text-xs uppercase">Thread banner</h2>
                            <button type="button" onClick={() => setIsEditingBanner(false)} aria-label="Close banner editor" className="text-ink-400 hover:text-ink-50"><X className="w-4 h-4" /></button>
                        </div>
                        <ImageUploader initialUrl={liveThread.bannerUrl} initialPosition={liveThread.bannerPosition} folder="thread_banners" shape="banner" onImageChanged={handleBannerUpdate} />
                    </div>
                </div>
            )}

            <div className={wide ? 'w-full px-3 md:px-6 pt-6 pb-32 flex items-start gap-6' : 'w-full px-3 md:px-6 pt-4 pb-32 flex flex-col gap-4'}>
                {user && (
                    <aside className={wide ? 'sticky top-6 flex flex-col gap-4 shrink-0 w-60' : 'order-1 flex flex-col gap-4 w-full'} aria-label="Character locations">
                        <LocationsPanel collapsible={!wide} character={activeChar} locations={locations} loading={locationsLoading}
                            currentThreadId={thread?.id} regionName={regionName} onOpenThread={openThread} />
                    </aside>
                )}

                <main className={`flex-1 min-w-0 w-full flex flex-col gap-4 ${wide ? '' : 'order-3'}`} aria-busy={posts === null}>
                    <section data-thread-top className={`${cardCls} scroll-mt-6 p-4 md:px-6 flex flex-wrap items-center gap-4`}>
                        <Avatar name={liveThread?.createdBy} imageUrl={creator?.imageUrl} imagePosition={creator?.imagePosition} className="w-12 h-12 text-xl" />
                        <div className="flex-1 min-w-[14rem] flex flex-col gap-1">
                            <h2 className="font-serif text-2xl leading-tight text-ink-50">{liveThread?.title}</h2>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" aria-hidden="true" /><span>By <span className="text-gold-500">{liveThread?.createdBy || 'Unknown'}</span></span></span>
                                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" aria-hidden="true" /><span>{timeAgo(liveThread?.createdAt)}</span></span>
                                <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /><span>{replies} {replies === 1 ? 'reply' : 'replies'}</span></span>
                                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" aria-hidden="true" /><span>{views} views</span></span>
                            </div>
                        </div>
                        {pages > 1 && <Pager page={currentPage} pages={pages} onPage={changePage} label="Thread pages, top" />}
                    </section>

                    <div className="flex flex-col gap-4">
                        {posts === null && (
                            <>
                                <span className="sr-only">Loading posts…</span>
                                {[0, 1, 2].map((i) => <PostSkeleton key={i} />)}
                            </>
                        )}
                        {posts?.length === 0 && (
                            <div className={`${cardCls} py-16 text-center`}>
                                <p className="font-serif text-3xl text-ink-300">No posts yet</p>
                                <p className="mt-2 text-sm text-ink-400">Write the opening of this tale in the reply box below.</p>
                            </div>
                        )}
                        {pagePosts.map((post, i) => (
                            <PostItem
                                key={post.id}
                                post={post}
                                number={firstShown + i}
                                user={user}
                                isAdmin={isAdmin}
                                isAdminOrMod={isAdminOrMod}
                                editingPostId={editingPostId}
                                editPostContent={editPostContent}
                                onEditStart={handleEditPostStart}
                                onEditSave={handleEditPostSave}
                                onEditCancel={handleEditCancel}
                                onEditChange={setEditPostContent}
                                onDelete={handleDeletePost}
                                onMessageUser={onMessageUser}
                                onOpenCodex={onOpenCodex}
                                onCopyUserId={handleCopyUserId}
                                onManageUser={handleManageUser}
                                onWikiLink={onWikiLink}
                                copiedUserId={copiedUserId}
                            />
                        ))}
                    </div>

                    {pages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                            <span className="text-xs text-ink-400">
                                Page {currentPage} of {pages} · posts {firstShown}–{firstShown + pagePosts.length - 1} of {total}
                            </span>
                            <Pager page={currentPage} pages={pages} onPage={changePage} label="Thread pages, bottom" />
                        </div>
                    )}

                    {/* Reply box: floats above the roster bar while the thread is in view */}
                    <div className="sticky bottom-20 z-30">
                        {!user ? (
                            <div className="rounded-[14px] bg-ink-900 border border-gold-900/50 p-4 flex items-center justify-between gap-3 shadow-[0_-8px_32px_rgb(0_0_0/.35)]">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Lock className="w-5 h-5 text-gold-500 shrink-0" aria-hidden="true" />
                                    <p className="text-ink-300 text-sm">Join the chronicles to reply.</p>
                                </div>
                                <button type="button" onClick={onRequireAuth} className="bg-gold-700 hover:bg-gold-600 text-white px-4 py-2 rounded text-sm font-bold shrink-0">Login / Signup</button>
                            </div>
                        ) : !canReply ? (
                            <div className="rounded-[14px] bg-ink-900 border border-ink-700 px-5 py-4 flex items-center gap-3 shadow-(--card-shadow)">
                                <Lock className="w-[18px] h-[18px] text-gold-500 shrink-0" aria-hidden="true" />
                                <span className="font-serif italic text-lg text-ink-200">This thread is sealed. No new posts can be added.</span>
                            </div>
                        ) : !replyOpen ? (
                            <div className="rounded-[14px] bg-ink-900 border border-gold-900/50 p-3 flex items-center gap-3 shadow-[0_-8px_32px_rgb(0_0_0/.35)]">
                                <Avatar name={activeChar?.name} imageUrl={activeChar?.imageUrl} imagePosition={activeChar?.imagePosition} className="w-10 h-10 text-lg" />
                                <button type="button" onClick={() => setReplyOpen(true)} className="flex-1 min-w-0 text-left bg-ink-800 border border-ink-700 hover:border-gold-700 rounded-full px-4 py-2.5 font-serif italic text-lg text-ink-400 truncate transition-colors">
                                    {activeChar ? `Continue the tale as ${firstName(activeChar.name)}…` : 'Choose a character in the roster to reply…'}
                                </button>
                                <button type="button" onClick={() => setReplyOpen(true)} className="hidden md:flex items-center gap-2 shrink-0 bg-gold-700 hover:bg-gold-600 text-white rounded px-4 py-2.5 text-sm font-bold transition-colors">
                                    <Feather className="w-4 h-4" aria-hidden="true" /><span>Write reply</span>
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-[14px] bg-ink-900 border border-gold-700 p-4 flex flex-col gap-3 shadow-[0_-8px_40px_rgb(0_0_0/.45)]">
                                <div className="flex items-center gap-3">
                                    <Avatar name={activeChar?.name} imageUrl={activeChar?.imageUrl} imagePosition={activeChar?.imagePosition} className="w-10 h-10 text-lg" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-2xs uppercase tracking-widest text-ink-400">Writing as</div>
                                        <div className="font-serif text-lg leading-tight text-gold-100 truncate">
                                            {activeChar ? <>{activeChar.name} <span className="text-sm text-ink-400 font-sans">· {[activeChar.race, activeChar.class].filter(Boolean).join(' ')}</span></> : 'No character selected'}
                                        </div>
                                    </div>
                                    <span className="text-2xs text-ink-400 hidden md:block">Will be post #{total + 1}</span>
                                    <button type="button" onClick={() => setReplyOpen(false)} aria-label="Minimise reply box" className="p-2 rounded text-ink-400 hover:text-ink-50 hover:bg-ink-800 transition-colors">
                                        <ChevronDown className="w-[18px] h-[18px]" strokeWidth={2.2} aria-hidden="true" />
                                    </button>
                                </div>
                                {replyError && <div className="text-red-400 text-xs bg-red-950 border border-red-900 rounded px-3 py-2" role="alert">{replyError}</div>}
                                <MarkdownEditor
                                    value={replyContent}
                                    onChange={(e) => { setReplyContent(e.target.value); if (replyError) setReplyError(null); }}
                                    placeholder="Write your character's next move…"
                                    minHeight="min-h-[8rem]"
                                    onPost={handleReply}
                                    submitLabel={cooldown ? 'Cooling…' : 'Post reply'}
                                    disabled={isSending || cooldown}
                                    isSubmitDisabled={!replyContent.trim() || !activeCharId || cooldown}
                                    isSubmitting={isSending}
                                    onWikiLink={onWikiLink}
                                />
                            </div>
                        )}
                    </div>
                </main>

                <aside className={wide ? 'sticky top-6 flex flex-col gap-6 shrink-0 w-68' : 'order-2 flex flex-col gap-4 w-full'} aria-label="Thread details">
                    {liveThread && (
                        <ThreadInfo thread={liveThread} creator={creator} regionLabel={regionLabel} replies={replies} collapsible={!wide}
                            onJumpLatest={() => goToPost(total)} onOpenRegion={openRegion} />
                    )}
                    {user && (
                        <ActivityPanel collapsible={!wide} character={activeChar} activity={activity.filter(a => a.threadId !== thread?.id)}
                            onOpenThread={openThread} onMarkAllRead={markAllRead} showExcerpts={false} />
                    )}
                </aside>
            </div>

            {/* Admin role manager */}
            {managingUser && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div role="dialog" aria-label="Manage role" className="bg-ink-900 border border-gold-900 rounded-xl p-6 max-w-sm w-full shadow-2xl relative">
                        <button type="button" onClick={() => setManagingUser(null)} aria-label="Close" className="absolute top-4 right-4 text-ink-500 hover:text-ink-50"><X className="w-5 h-5" /></button>
                        <div className="flex items-center gap-3 mb-4 text-gold-500"><Gavel className="w-8 h-8" aria-hidden="true" /><h3 className="text-xl font-bold font-serif">Admin Court</h3></div>
                        <p className="text-ink-300 mb-6">Managing access for <span className="font-bold text-ink-50">{managingUser.name}</span>.</p>
                        <div className="mb-6 p-3 bg-ink-950 border border-ink-800 rounded flex items-center justify-between">
                            <span className="text-sm text-ink-500 uppercase font-bold">Current Status:</span>
                            {managingUserRole === null
                                ? <span className="flex items-center gap-2 text-ink-400 text-sm"><Loader className="w-3 h-3 animate-spin" aria-hidden="true" /> Checking...</span>
                                : <span className={`text-sm font-bold uppercase ${managingUserRole === 'admin' ? 'text-red-400' : managingUserRole === 'moderator' ? 'text-indigo-400' : managingUserRole === 'banned' ? 'text-ink-600 line-through' : 'text-emerald-400'}`}>{managingUserRole}</span>}
                        </div>
                        <div className="space-y-2">
                            <button type="button" onClick={() => handleUpdateRole('user')} className="w-full text-left px-4 py-3 rounded bg-ink-800 hover:bg-ink-700 text-ink-300 hover:text-ink-50 border border-ink-700 flex justify-between items-center group"><span>User (Default)</span><User className="w-4 h-4 opacity-0 group-hover:opacity-100" aria-hidden="true" /></button>
                            <button type="button" onClick={() => handleUpdateRole('moderator')} className="w-full text-left px-4 py-3 rounded bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-900/50 flex justify-between items-center group"><span>Moderator</span><Shield className="w-4 h-4 opacity-0 group-hover:opacity-100" aria-hidden="true" /></button>
                            <button type="button" onClick={() => handleUpdateRole('admin')} className="w-full text-left px-4 py-3 rounded bg-gold-900/30 hover:bg-gold-900/50 text-gold-300 border border-gold-900/50 flex justify-between items-center group"><span>Administrator</span><ShieldAlert className="w-4 h-4 opacity-0 group-hover:opacity-100" aria-hidden="true" /></button>
                            <div className="h-px bg-ink-800 my-2" />
                            <button type="button" onClick={() => handleUpdateRole('banned')} className="w-full text-left px-4 py-3 rounded bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 flex justify-between items-center group"><span>Ban User</span><Gavel className="w-4 h-4 opacity-0 group-hover:opacity-100" aria-hidden="true" /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(ThreadView);
