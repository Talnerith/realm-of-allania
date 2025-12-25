import { useState, useEffect, useRef, useCallback } from 'react';
import {
    collection, query, addDoc, onSnapshot, doc, setDoc, getDoc,
    serverTimestamp, updateDoc, deleteDoc, getDocs, writeBatch, where, increment, orderBy
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import {
    Map as MapIcon, ChevronLeft, Ghost,
    Edit3, Loader, Trash2, Shield, Check, User, X, Gavel, ShieldAlert, MessageCircle, Lock
} from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';
import MarkdownEditor from '@/components/MarkdownEditor';
import PostItem from '@/components/Forum/PostItem';

export default function ThreadView({ thread, setView, region, onOpenCodex, onMessageUser, onRequireAuth, onWikiLink }) {
    const { user, userRole, characters, activeCharId } = useGame();
    const [posts, setPosts] = useState([]);
    const [liveThread, setLiveThread] = useState(thread);
    const [replyContent, setReplyContent] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [cooldown, setCooldown] = useState(false);

    // Banner Edit State
    const [isEditingBanner, setIsEditingBanner] = useState(false);

    // Post Edit State
    const [editingPostId, setEditingPostId] = useState(null);
    const [editPostContent, setEditPostContent] = useState('');

    // Admin Helper
    const [copiedUserId, setCopiedUserId] = useState(null);
    const [managingUser, setManagingUser] = useState(null);
    const [managingUserRole, setManagingUserRole] = useState(null);

    // Scroll Ref
    const scrollContainerRef = useRef(null);

    const isAdmin = userRole === 'admin';
    const isAdminOrMod = userRole === 'admin' || userRole === 'moderator';
    const isThreadOwner = user && liveThread && user.uid === liveThread.creatorId;
    const canEditBanner = isAdminOrMod || isThreadOwner;
    const canDeleteThread = isAdminOrMod;

    // 1. MARK AS READ ON ENTRY (Only if User)
    useEffect(() => {
        if (user && thread) {
            setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', thread.id), {
                lastRead: serverTimestamp()
            }, { merge: true });
        }
    }, [user, thread]);

    // 2. Fetch Data
    useEffect(() => {
        if (!thread) return;

        const unsubThread = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), (doc) => {
            if (doc.exists()) { setLiveThread({ id: doc.id, ...doc.data() }); }
            else { setView('region'); }
        });

        // OPTIMIZATION: Database-side sorting
        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'),
            where('threadId', '==', thread.id),
            orderBy('createdAt', 'asc') // Ensure you have an index for threadId + createdAt
        );

        const unsubPosts = onSnapshot(q, (snapshot) => {
            const p = [];
            snapshot.docs.forEach(d => { p.push({ id: d.id, ...d.data() }); });
            // Fallback sort just in case (e.g. pending writes)
            p.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
            setPosts(p);
        }, (error) => {
            console.error("Error fetching posts:", error);
        });

        return () => { unsubThread(); unsubPosts(); };
    }, [thread, setView]);

    // 3. Auto-Scroll on New Posts
    useEffect(() => {
        if (scrollContainerRef.current) {
            const { scrollHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTo({
                top: scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [posts.length]);

    // Admin Role Fetcher...
    useEffect(() => {
        if (managingUser) {
            setManagingUserRole(null);
            const fetchRole = async () => {
                try {
                    const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', managingUser.id, 'settings', 'account'));
                    if (snap.exists()) setManagingUserRole(snap.data().role || 'user');
                    else setManagingUserRole('user');
                } catch (e) { console.error("Error fetching role:", e); setManagingUserRole('error'); }
            };
            fetchRole();
        }
    }, [managingUser]);

    const handleReply = useCallback(async () => {
        if (!user) return onRequireAuth();
        if (!activeCharId) return alert("Please select a character from the roster before posting.");
        if (replyContent.trim().length < 10) return alert("Post must be at least 10 characters.");
        if (cooldown) return;

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
                createdAt: serverTimestamp()
            });

            // 2. Update Thread Metadata (ATOMIC INCREMENT)
            const threadRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id);
            batch.update(threadRef, {
                updatedAt: serverTimestamp(),
                postCount: increment(1)
            });

            // 3. Update User Read Receipt
            const receiptRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', thread.id);
            batch.set(receiptRef, { lastRead: serverTimestamp() }, { merge: true });

            await batch.commit();

            setReplyContent('');
            setCooldown(true);
            setTimeout(() => setCooldown(false), 2000);

        } catch (e) {
            console.error(e);
            alert("Failed to post reply. Please check connection or limits.");
        } finally {
            setIsSending(false);
        }
    }, [user, activeCharId, replyContent, cooldown, characters, thread, onRequireAuth]);

    const handleEditPostStart = useCallback((post) => {
        if (post.characterId !== activeCharId) { alert(`You must be playing as ${post.characterName} to edit this post content.`); return; }
        setEditingPostId(post.id);
        setEditPostContent(post.content);
    }, [activeCharId]);

    const handleEditPostSave = useCallback(async () => {
        if (!editingPostId || !editPostContent.trim()) return;
        if (editPostContent.length < 10) return alert("Content too short.");
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'posts', editingPostId), { content: editPostContent, isEdited: true, editedAt: serverTimestamp() });
            setEditingPostId(null); setEditPostContent('');
        } catch (e) { console.error(e); }
    }, [editingPostId, editPostContent]);

    const handleEditCancel = useCallback(() => {
        setEditingPostId(null);
        setEditPostContent('');
    }, []);

    const handleBannerUpdate = useCallback(async (url, position) => {
        try {
            // CLEANUP: Delete old banner if it exists and we have permission
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
            // 1. Delete Thread Doc
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id));

            // 2. Delete Posts Batch
            const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), where("threadId", "==", thread.id));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();

            // 3. CLEANUP: Delete Thread Banner if it exists
            if (liveThread.bannerUrl && liveThread.bannerUrl.includes('firebasestorage')) {
                try { await deleteObject(ref(storage, liveThread.bannerUrl)); } catch (e) { console.warn("Banner cleanup failed:", e); }
            }

            setView('region');
        } catch (e) { console.error(e); }
    };

    const handleCopyUserId = useCallback((id) => {
        navigator.clipboard.writeText(id);
        setCopiedUserId(id);
        setTimeout(() => setCopiedUserId(null), 2000);
    }, []);

    const handleManageUser = useCallback((userObj) => {
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

    if (!liveThread) return <div className="h-full flex items-center justify-center text-slate-500"><Loader className="animate-spin mr-2" /> Loading...</div>;

    const threadBanner = liveThread.bannerUrl || null;
    const bannerPos = liveThread.bannerPosition || 'center';

    return (
        <div ref={scrollContainerRef} className="h-full overflow-y-auto custom-scrollbar bg-slate-900 pb-80">
            {/* Thread Banner */}
            {threadBanner && (
                <div className="relative w-full h-64 md:h-96 bg-slate-900 border-b border-amber-900/50 overflow-hidden shrink-0 group">
                    <img
                        src={threadBanner}
                        className="w-full h-full object-cover opacity-60 transition-all duration-300"
                        style={{ objectPosition: bannerPos }}
                        onError={(e) => e.target.style.display = 'none'}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-slate-950 to-transparent" />
                    {canEditBanner && (
                        <button onClick={() => setIsEditingBanner(!isEditingBanner)} className="absolute top-4 right-4 p-2 bg-black/60 text-white hover:text-amber-500 rounded-full border border-white/20 transition-all opacity-0 group-hover:opacity-100"><Edit3 className="w-4 h-4" /></button>
                    )}
                </div>
            )}

            {isEditingBanner && (
                <div className="bg-slate-900 border-b border-amber-900/30 p-4 animate-in slide-in-from-top-2 relative z-30">
                    <div className="max-w-4xl mx-auto space-y-2">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-amber-500 font-bold text-xs uppercase">Edit Thread Banner</h4>
                            <button onClick={() => setIsEditingBanner(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <ImageUploader
                            initialUrl={liveThread.bannerUrl}
                            initialPosition={liveThread.bannerPosition}
                            folder="thread_banners"
                            shape="banner"
                            onImageChanged={handleBannerUpdate}
                        />
                    </div>
                </div>
            )}

            <div className={`flex items-center gap-4 px-4 md:px-8 py-6 ${threadBanner ? 'relative -mt-20 z-10' : 'sticky top-0 bg-slate-950/95 backdrop-blur-md z-20 border-b border-slate-800'}`}>
                <button onClick={() => setView('region')} className={`flex items-center gap-1 ${threadBanner ? "bg-black/50 px-3 py-1 rounded hover:bg-black/70 text-white border-none" : "text-slate-400 hover:text-white"}`}><ChevronLeft className="w-5 h-5" /> Back</button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className={`text-2xl md:text-3xl font-serif font-bold ${threadBanner ? 'text-white drop-shadow-lg' : 'text-amber-100'}`}>{liveThread.title}</h1>
                        {!threadBanner && canEditBanner && <button onClick={() => setIsEditingBanner(!isEditingBanner)} className="text-slate-500 hover:text-amber-500"><Edit3 className="w-4 h-4" /></button>}
                        {canDeleteThread && <button onClick={handleDeleteThread} className="text-red-900/50 hover:text-red-500" title="Delete Thread"><Trash2 className="w-5 h-5" /></button>}
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${threadBanner ? 'text-amber-200/80' : 'text-amber-600/60'}`}><MapIcon className="w-3 h-3" /> {region ? region.name : 'Unknown Region'}</div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-6">
                {posts.map((post) => (
                    <PostItem
                        key={post.id}
                        post={post}
                        user={user}
                        activeCharId={activeCharId}
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

            {/* ADMIN ROLE MANAGER */}
            {managingUser && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-amber-900 rounded-xl p-6 max-w-sm w-full shadow-2xl relative">
                        <button onClick={() => setManagingUser(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                        <div className="flex items-center gap-3 mb-4 text-amber-500"><Gavel className="w-8 h-8" /><h3 className="text-xl font-bold font-serif">Admin Court</h3></div>
                        <p className="text-slate-300 mb-6">Managing access for <span className="font-bold text-white">{managingUser.name}</span>.</p>

                        <div className="mb-6 p-3 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                            <span className="text-sm text-slate-500 uppercase font-bold">Current Status:</span>
                            {managingUserRole === null ? (<span className="flex items-center gap-2 text-slate-400 text-sm"><Loader className="w-3 h-3 animate-spin" /> Checking...</span>) : (
                                <span className={`text-sm font-bold uppercase ${managingUserRole === 'admin' ? 'text-red-400' : managingUserRole === 'moderator' ? 'text-indigo-400' : managingUserRole === 'banned' ? 'text-slate-600 line-through' : 'text-emerald-400'}`}>{managingUserRole}</span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <button onClick={() => handleUpdateRole('user')} className="w-full text-left px-4 py-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex justify-between items-center group"><span>User (Default)</span><User className="w-4 h-4 opacity-0 group-hover:opacity-100" /></button>
                            <button onClick={() => handleUpdateRole('moderator')} className="w-full text-left px-4 py-3 rounded bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-900/50 flex justify-between items-center group"><span>Moderator</span><Shield className="w-4 h-4 opacity-0 group-hover:opacity-100" /></button>
                            <button onClick={() => handleUpdateRole('admin')} className="w-full text-left px-4 py-3 rounded bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border border-amber-900/50 flex justify-between items-center group"><span>Administrator</span><ShieldAlert className="w-4 h-4 opacity-0 group-hover:opacity-100" /></button>
                            <div className="h-px bg-slate-800 my-2"></div>
                            <button onClick={() => handleUpdateRole('banned')} className="w-full text-left px-4 py-3 rounded bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 flex justify-between items-center group"><span>Ban User</span><Gavel className="w-4 h-4 opacity-0 group-hover:opacity-100" /></button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reply Box - FIXED FOR GUEST */}
            <div className="fixed bottom-14 md:bottom-16 left-0 right-0 p-4 z-30 transition-all">
                {user ? (
                    <div className="max-w-4xl mx-auto flex gap-4 items-end bg-slate-950/90 backdrop-blur-md border border-amber-900/30 p-3 rounded-xl shadow-2xl">
                        <div className="hidden md:block w-12 h-12 bg-slate-800 rounded border border-slate-700 shrink-0 overflow-hidden relative">
                            {activeCharId && characters.find(c => c.id === activeCharId) ? (
                                <><img src={characters.find(c => c.id === activeCharId).imageUrl || ''} className="w-full h-full object-cover" style={{ objectPosition: characters.find(c => c.id === activeCharId).imagePosition || 'center' }} onError={(e) => e.target.style.display = 'none'} /><div className="absolute inset-0 flex items-center justify-center font-bold text-amber-500 bg-slate-800 -z-10">{characters.find(c => c.id === activeCharId).name.substring(0, 1)}</div></>
                            ) : <div className="w-full h-full flex items-center justify-center text-slate-600"><Ghost className="w-6 h-6" /></div>}
                        </div>

                        <div className="flex-1 flex flex-col gap-3">
                            <MarkdownEditor
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder={activeCharId ? `Reply as ${characters.find(c => c.id === activeCharId)?.name}...` : "Create a character to reply..."}
                                minHeight="min-h-[60px]"
                                onPost={handleReply}
                                submitLabel={cooldown ? "Cooling..." : "Post Reply"}
                                disabled={isSending || cooldown}
                                isSubmitDisabled={!replyContent.trim() || !activeCharId || cooldown}
                                isSubmitting={isSending}
                                onWikiLink={onWikiLink}
                            />
                        </div>
                    </div>
                ) : (
                    /* GUEST CALL TO ACTION */
                    <div className="max-w-xl mx-auto bg-slate-900/90 backdrop-blur-md border border-amber-900/50 p-4 rounded-xl shadow-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Lock className="w-5 h-5 text-amber-500" />
                            <p className="text-slate-300 text-sm">Join the chronicles to reply.</p>
                        </div>
                        <button
                            onClick={onRequireAuth}
                            className="bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded text-sm font-bold shadow-lg"
                        >
                            Login / Signup
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}