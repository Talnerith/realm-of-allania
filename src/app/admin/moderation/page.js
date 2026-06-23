"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, limit, getDocs, writeBatch } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { useGame } from '@/context/GameContext';
import { Shield, AlertTriangle, Check, X, Trash2, Filter, ChevronLeft, RefreshCw, Image as ImageIcon, FileText, BookOpen, Trash } from 'lucide-react';

export default function ModerationDashboard() {
    const { user, userRole, loading: authLoading } = useGame();
    const router = useRouter();

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('needs_review'); // needs_review, rejected, approved, all
    const [contentType, setContentType] = useState('posts'); // posts, codex, images
    const [limitCount, setLimitCount] = useState(50);

    // 1. Access Control
    useEffect(() => {
        if (!authLoading && (!user || (userRole !== 'admin' && userRole !== 'moderator'))) {
            router.push('/');
        }
    }, [user, userRole, authLoading, router]);

    // 2. Data Fetching - ALL CONTENT TYPES NOW USE moderation_logs
    useEffect(() => {
        if (!user || (userRole !== 'admin' && userRole !== 'moderator')) return;

        setLoading(true);
        
        // All content types now use moderation_logs collection
        const collectionPath = 'moderation_logs';
        const orderField = 'timestamp';

        const contentRef = collection(db, 'artifacts', APP_ID, 'public', 'data', collectionPath);

        let q;
        try {
            // Build query based on content type and filter
            const typeFilter = contentType === 'posts' ? 'post' : contentType === 'codex' ? 'codex' : 'image';
            
            if (filter === 'all') {
                q = query(
                    contentRef, 
                    where('type', '==', typeFilter), 
                    orderBy(orderField, 'desc'), 
                    limit(limitCount)
                );
            } else {
                q = query(
                    contentRef, 
                    where('type', '==', typeFilter), 
                    where('status', '==', filter), 
                    orderBy(orderField, 'desc'), 
                    limit(limitCount)
                );
            }
        } catch (e) {
            console.warn("Index missing likely, falling back to simple query", e);
            const typeFilter = contentType === 'posts' ? 'post' : contentType === 'codex' ? 'codex' : 'image';
            q = query(
                contentRef, 
                where('type', '==', typeFilter), 
                limit(limitCount)
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPosts(items);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching content:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userRole, filter, contentType, limitCount]);

    // 3. Actions - Hard delete now removes both logs AND actual content
    const handleAction = async (itemId, action, item = null) => {
        try {
            // All items are from moderation_logs now
            const itemRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'moderation_logs', itemId);
            
            if (action === 'delete') {
                const confirmMessage = item.type === 'image' 
                    ? 'Are you sure you want to permanently delete this image?'
                    : 'Are you sure you want to permanently delete this content? This will remove both the moderation log AND the actual content.';
                    
                if (confirm(confirmMessage)) {
                    // For images, delete the storage file
                    if (item.type === 'image' && item?.filePath) {
                        try {
                            const fileRef = ref(storage, item.filePath);
                            await deleteObject(fileRef);
                            console.log(`Deleted storage file: ${item.filePath}`);
                        } catch (e) {
                            console.warn("Could not delete storage file:", e);
                        }
                    }
                    
                    // HARD DELETE: Also delete the actual content (post or codex page)
                    if (item.contentId) {
                        try {
                            let contentCollection = null;
                            if (item.type === 'post') {
                                contentCollection = 'posts';
                            } else if (item.type === 'codex') {
                                contentCollection = 'codex_pages';
                            }
                            
                            if (contentCollection) {
                                const contentRef = doc(db, 'artifacts', APP_ID, 'public', 'data', contentCollection, item.contentId);
                                await deleteDoc(contentRef);
                                console.log(`Deleted ${item.type} content: ${item.contentId}`);
                            }
                        } catch (e) {
                            console.warn("Could not delete content item:", e);
                        }
                    }
                    
                    // Delete the moderation log entry
                    await deleteDoc(itemRef);
                }
            } else {
                // Update the moderation log status
                await updateDoc(itemRef, {
                    status: action, // 'approved' or 'rejected'
                    moderatedBy: user.uid,
                    moderatedAt: new Date(),
                    moderationMethod: 'manual-admin'
                });

                // Also update the actual content item if it exists
                if (item.contentId) {
                    try {
                        let contentCollection;
                        if (item.type === 'post') {
                            contentCollection = 'posts';
                        } else if (item.type === 'codex') {
                            contentCollection = 'codex_pages';
                        }
                        
                        if (contentCollection) {
                            const contentRef = doc(db, 'artifacts', APP_ID, 'public', 'data', contentCollection, item.contentId);
                            await updateDoc(contentRef, {
                                status: action,
                                moderatedBy: user.uid,
                                moderatedAt: new Date(),
                                moderationMethod: 'manual-admin'
                            });
                            
                            // If approving a post, also approve the parent thread so it becomes visible
                            if (item.type === 'post' && action === 'approved' && item.threadId) {
                                try {
                                    const threadRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', item.threadId);
                                    await updateDoc(threadRef, {
                                        status: 'approved',
                                        moderatedBy: user.uid,
                                        moderatedAt: new Date()
                                    });
                                    console.log(`Also approved parent thread ${item.threadId}`);
                                } catch (threadErr) {
                                    console.warn("Could not update parent thread status:", threadErr);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Could not update content item (may have been deleted):", e);
                    }
                }
            }
        } catch (e) {
            alert("Action failed: " + e.message);
        }
    };

    // 4. Delete All Items in Current Tab - Only deletes moderation logs
    const handleDeleteAll = async () => {
        if (posts.length === 0) return;
        
        const filterLabel = filter === 'needs_review' ? 'Needs Review' : filter;
        if (!confirm(`Are you sure you want to delete ALL ${posts.length} moderation log entries in the "${filterLabel}" tab? This will NOT delete the actual content, only the moderation logs.`)) {
            return;
        }

        try {
            // All items are from moderation_logs
            const batches = [];
            let currentBatch = writeBatch(db);
            let operationCount = 0;

            for (const item of posts) {
                // For images, delete the storage file first
                if (item.type === 'image' && item.filePath) {
                    try {
                        const fileRef = ref(storage, item.filePath);
                        await deleteObject(fileRef);
                    } catch (e) {
                        console.warn("Could not delete storage file:", e);
                    }
                }

                const itemRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'moderation_logs', item.id);
                currentBatch.delete(itemRef);
                operationCount++;

                if (operationCount === 500) {
                    batches.push(currentBatch);
                    currentBatch = writeBatch(db);
                    operationCount = 0;
                }
            }

            if (operationCount > 0) {
                batches.push(currentBatch);
            }

            // Execute all batches
            await Promise.all(batches.map(batch => batch.commit()));
            
            alert(`Successfully deleted ${posts.length} moderation log entries.`);
        } catch (e) {
            alert("Delete all failed: " + e.message);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center font-serif">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                    <p>Consulting the Oracle...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-900 selection:text-white">
            {/* Header */}
            <header className="bg-slate-900 border-b border-amber-900/30 p-4 sticky top-0 z-10 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors" title="Back to Game">
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-serif font-bold text-amber-100 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-amber-500" />
                            Moderation Dashboard
                        </h1>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Realm of Allania Admin</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Content Type Selector */}
                    <div className="hidden md:flex items-center bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
                        {[
                            { value: 'posts', label: 'Posts' },
                            { value: 'codex', label: 'Codex' },
                            { value: 'images', label: 'Images' }
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setContentType(value)}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${contentType === value ? 'bg-indigo-900/50 text-indigo-200 shadow-sm' : 'text-slate-500 hover:text-white hover:bg-slate-700/50'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    
                    {/* Status Filter */}
                    <div className="hidden md:flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                        {['needs_review', 'rejected', 'approved', 'all'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-all ${filter === s ? 'bg-amber-900/50 text-amber-200 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            >
                                {s === 'needs_review' ? 'Needs Review' : s === 'rejected' ? 'Flagged' : s}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-500 font-mono">
                            {posts.length} Items (Limit {limitCount})
                        </div>
                        {posts.length > 0 && (
                            <button
                                onClick={handleDeleteAll}
                                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/50 text-red-400 hover:text-red-300 border border-red-900/50 rounded text-xs font-bold transition-all"
                                title={`Delete all ${posts.length} items in current tab`}
                            >
                                <Trash className="w-3.5 h-3.5" /> Delete All
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content - with scrollable area */}
            <main className="p-4 md:p-8 max-w-7xl mx-auto max-h-[calc(100vh-80px)] overflow-y-auto custom-scrollbar">

                {/* Mobile Content Type Selector */}
                <div className="md:hidden mb-4 overflow-x-auto pb-2 flex gap-2">
                    {[
                        { value: 'posts', label: 'Posts' },
                        { value: 'codex', label: 'Codex' },
                        { value: 'images', label: 'Images' }
                    ].map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setContentType(value)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border transition-colors ${contentType === value ? 'bg-indigo-900/20 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Mobile Filter */}
                <div className="md:hidden mb-6 overflow-x-auto pb-2 flex gap-2">
                    {['needs_review', 'rejected', 'approved', 'all'].map(s => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border transition-colors ${filter === s ? 'bg-amber-900/20 border-amber-500 text-amber-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                        >
                            {s === 'needs_review' ? 'Review' : s === 'rejected' ? 'Flagged' : s}
                        </button>
                    ))}
                </div>

                {/* Mobile Delete All Button */}
                {posts.length > 0 && (
                    <div className="md:hidden mb-4">
                        <button
                            onClick={handleDeleteAll}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg text-sm font-bold transition-all"
                        >
                            <Trash className="w-4 h-4" /> Delete All {posts.length} Items
                        </button>
                    </div>
                )}

                {posts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-500 border border-dashed border-slate-800 rounded-lg bg-slate-900/30">
                        <Check className="w-12 h-12 mb-4 text-green-500/50" />
                        <p className="text-lg">No content found in this queue.</p>
                        <p className="text-sm">Great job, Moderator!</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {posts.map(item => (
                            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm hover:border-slate-700 transition-colors group">
                                <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
                                    {/* Content */}
                                    <div className="flex-1 space-y-2 w-full">
                                        {/* Header with metadata */}
                                        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                                            {/* Content Type Icon */}
                                            <span className="flex items-center gap-1">
                                                {contentType === 'posts' && <FileText className="w-3 h-3" />}
                                                {contentType === 'codex' && <BookOpen className="w-3 h-3" />}
                                                {contentType === 'images' && <ImageIcon className="w-3 h-3" />}
                                                <span className="font-mono text-slate-400">{item.id.slice(0, 8)}...</span>
                                            </span>
                                            <span>•</span>
                                            <span>{new Date(item.createdAt?.toDate?.() || item.timestamp?.toDate?.() || item.createdAt || item.timestamp).toLocaleString()}</span>
                                            <span>•</span>
                                            <span className="text-amber-500/80">User: {item.userId || item.creatorId}</span>
                                            {item.moderationMethod && (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase border ${item.moderationMethod.includes('ai') ? 'border-purple-500/30 text-purple-400' : item.moderationMethod.includes('fallback') ? 'border-orange-500/30 text-orange-400' : 'border-slate-700 text-slate-400'}`}>
                                                    {item.moderationMethod}
                                                </span>
                                            )}
                                            {/* Status Badge */}
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase border ${
                                                item.status === 'approved' ? 'border-green-500/30 text-green-400' :
                                                item.status === 'rejected' ? 'border-red-500/30 text-red-400' :
                                                item.status === 'needs_review' ? 'border-orange-500/30 text-orange-400' :
                                                'border-yellow-500/30 text-yellow-400'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </div>

                        {/* Content Display based on type */}
                        {item.type === 'image' ? (
                                            <div className="space-y-2">
                                                <div className="bg-black/50 p-3 rounded border border-slate-800/50 text-slate-200">
                                                    <div className="text-xs text-slate-500 mb-1">File Path:</div>
                                    <code className="text-sm break-all">{item.filePath}</code>
                                </div>
                            </div>
                        ) : item.type === 'codex' ? (
                                            <div className="space-y-2">
                                                {item.title && (
                                                    <div className="text-amber-400 font-bold text-lg font-serif">{item.title}</div>
                                                )}
                                                <div className="bg-black/50 p-3 rounded border border-slate-800/50 font-serif text-slate-200 whitespace-pre-wrap max-h-64 overflow-y-auto">
                                                    {item.content}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-black/50 p-3 rounded border border-slate-800/50 font-serif text-slate-200 whitespace-pre-wrap">
                                                {item.content}
                                            </div>
                                        )}

                                        {/* Flagged Reason */}
                                        {item.flaggedReason && (
                                            <div className="flex items-start gap-2 bg-red-900/10 border border-red-900/30 p-2 rounded text-sm text-red-300">
                                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                                <span>
                                                    <strong className="font-bold text-red-400">Flagged:</strong> {item.flaggedReason}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0">
                                        {item.status !== 'approved' && (
                                            <button
                                                onClick={() => handleAction(item.id, 'approved', item)}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-900/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-900/50 rounded transition-all text-sm font-bold"
                                                title="Approve"
                                            >
                                                <Check className="w-4 h-4" /> Approve
                                            </button>
                                        )}

                                        {item.status !== 'rejected' && (
                                            <button
                                                onClick={() => handleAction(item.id, 'rejected', item)}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-900/50 rounded transition-all text-sm font-bold"
                                                title="Reject"
                                            >
                                                <X className="w-4 h-4" /> Reject
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleAction(item.id, 'delete', item)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-slate-500 hover:text-red-500 hover:bg-slate-800 rounded transition-all text-sm"
                                            title="Delete Permanently"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
