"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, deleteDoc, limit, getDocs, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { useGame } from '@/context/GameContext';
import { Shield, AlertTriangle, Check, X, Trash2, Filter, ChevronLeft, RefreshCw, Image as ImageIcon, FileText, BookOpen, Trash } from 'lucide-react';

// SHA-256 hex of a string; matches contentHash() in functions/index.js
async function sha256Hex(text) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text || ''));
    return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// What a log's contentHash covers. Codex entries: title, tags, category and
// content, all moderated together (matches codexModeratedFields() in
// functions/index.js). Older codex logs hashed the content alone, so they never
// match and count as "edited since": the safe default.
const hashedText = (type, data) => (type === 'codex'
    ? JSON.stringify([data.title || '', Array.isArray(data.tags) ? data.tags : [], data.category || '', data.content || ''])
    : data.content);

// Admin tool: images that still point at outside hosts (pasted before links
// were imported into Storage) are hidden on the site. Find them, then import
// them all into Storage and update every reference (migrateExternalImages).
function ExternalImagesTool() {
    const [state, setState] = useState('idle'); // idle | scanning | found | importing | done | error
    const [images, setImages] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const run = async (dryRun) => {
        setState(dryRun ? 'scanning' : 'importing');
        setError('');
        try {
            const res = await httpsCallable(functions, 'migrateExternalImages', { timeout: 540000 })({ dryRun });
            if (dryRun) {
                setImages(res.data.images);
                setState('found');
            } else {
                setResult(res.data);
                setState('done');
            }
        } catch (e) {
            setError(e.message);
            setState('error');
        }
    };

    return (
        <section className="mb-6 p-4 rounded-lg border border-ink-800 bg-ink-900" aria-labelledby="external-images-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 id="external-images-title" className="font-bold text-ink-100 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-gold-500" /> External images
                    </h2>
                    <p className="text-xs text-ink-400 mt-1">Images pasted as outside links are hidden on the site. Import them into storage to show them again.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => run(true)}
                        disabled={state === 'scanning' || state === 'importing'}
                        className="px-3 py-1.5 rounded text-sm font-bold border border-ink-700 text-ink-200 hover:bg-ink-800 disabled:opacity-50"
                    >
                        {state === 'scanning' ? 'Searching…' : 'Find external images'}
                    </button>
                    {state === 'found' && images.length > 0 && (
                        <button
                            onClick={() => run(false)}
                            className="px-3 py-1.5 rounded text-sm font-bold bg-gold-700 hover:bg-gold-600 text-white"
                        >
                            Import {images.length} image{images.length === 1 ? '' : 's'}
                        </button>
                    )}
                    {state === 'importing' && <span className="px-3 py-1.5 text-sm text-gold-400">Importing… this can take a minute</span>}
                </div>
            </div>

            {state === 'found' && (
                images.length === 0
                    ? <p className="mt-3 text-sm text-emerald-400">No external images found. Everything is hosted in storage.</p>
                    : (
                        <ul className="mt-3 space-y-1 text-xs text-ink-400 max-h-48 overflow-y-auto custom-scrollbar">
                            {images.map((img) => (
                                <li key={img.url} className="truncate">
                                    <span className="text-ink-200">{img.places.join(', ')}</span> · used {img.uses}× · {img.url}
                                </li>
                            ))}
                        </ul>
                    )
            )}
            {state === 'done' && result && (
                <div className="mt-3 text-sm">
                    <p className="text-emerald-400">Imported {result.imported} image{result.imported === 1 ? '' : 's'} and updated {result.documentsUpdated} document{result.documentsUpdated === 1 ? '' : 's'}.</p>
                    {result.documentsRemaining > 0 && (
                        <p className="mt-1 text-gold-400">Ran out of time with {result.documentsRemaining} document{result.documentsRemaining === 1 ? '' : 's'} left. Find external images again to continue where it stopped.</p>
                    )}
                    {result.failed.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-red-400">
                            {result.failed.map((f) => <li key={f.url} className="truncate">Couldn&apos;t import {f.url}: {f.error}</li>)}
                        </ul>
                    )}
                </div>
            )}
            {state === 'error' && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </section>
    );
}

export default function ModerationDashboard() {
    const { user, userRole, roleLoaded, loading: authLoading } = useGame();
    const router = useRouter();

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('needs_review'); // needs_review, rejected, approved, all
    const [contentType, setContentType] = useState('posts'); // posts, codex, images
    const [limitCount, setLimitCount] = useState(50);

    // 1. Access Control (the rules enforce it; this only redirects). The role
    // arrives after the auth state, so wait for it before deciding: on a
    // refresh userRole is still the default 'user' for a moment.
    useEffect(() => {
        if (authLoading) return;
        if (!user || (roleLoaded && userRole !== 'admin' && userRole !== 'moderator')) {
            router.push('/');
        }
    }, [user, userRole, roleLoaded, authLoading, router]);

    // 2. Data Fetching - ALL CONTENT TYPES NOW USE moderation_logs
    useEffect(() => {
        if (!user || (userRole !== 'admin' && userRole !== 'moderator')) return;

        // Defer to avoid a synchronous setState cascade inside the effect
        const loadingTimer = setTimeout(() => setLoading(true), 0);

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
            clearTimeout(loadingTimer);
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPosts(items);
            setLoading(false);
        }, (error) => {
            clearTimeout(loadingTimer);
            console.error("Error fetching content:", error);
            setLoading(false);
        });

        return () => { clearTimeout(loadingTimer); unsubscribe(); };
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
                    // For images, delete the storage file. Storage rules only let
                    // owners delete, so this goes through a moderator-only function;
                    // the log is kept if it fails, so the image isn't forgotten.
                    if (item.type === 'image' && item?.filePath) {
                        try {
                            await httpsCallable(functions, 'deleteUserImage')({ filePath: item.filePath });
                        } catch (e) {
                            alert("Could not delete the image: " + e.message);
                            return;
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
                const contentCollection = item.type === 'post' ? 'posts' : item.type === 'codex' ? 'codex_pages' : null;
                const contentRef = contentCollection && item.contentId
                    ? doc(db, 'artifacts', APP_ID, 'public', 'data', contentCollection, item.contentId)
                    : null;

                // Approve only what this entry showed the moderator. If the author
                // edited it since, the newer version has its own log entry.
                // Codex entries with a proposedEdit are the exception: the live page
                // was deliberately kept at its previous version, so approving
                // applies the flagged edit itself.
                let contentUpdate = {};
                if (action === 'approved' && contentRef) {
                    const live = await getDoc(contentRef);
                    if (live.exists() && item.proposedEdit) {
                        contentUpdate = item.proposedEdit;
                    } else if (live.exists() && item.contentHash
                        && await sha256Hex(hashedText(item.type, live.data())) !== item.contentHash) {
                        alert('This content was edited after it was flagged. Review its newer moderation entry instead.');
                        return;
                    }
                }

                // Update the moderation log status
                await updateDoc(itemRef, {
                    status: action, // 'approved' or 'rejected'
                    moderatedBy: user.uid,
                    moderatedAt: new Date(),
                    moderationMethod: 'manual-admin'
                });

                // Also update the actual content item if it exists
                if (contentRef) {
                    try {
                        await updateDoc(contentRef, {
                            ...contentUpdate,
                            status: action,
                            moderatedBy: user.uid,
                            moderatedAt: new Date(),
                            moderationMethod: 'manual-admin'
                        });

                        // Approving a pending thread's post publishes the thread too.
                        // A thread a moderator rejected stays rejected.
                        if (item.type === 'post' && action === 'approved' && item.threadId) {
                            try {
                                const threadRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', item.threadId);
                                const thread = await getDoc(threadRef);
                                if (thread.exists() && thread.data().status === 'pending') {
                                    await updateDoc(threadRef, {
                                        status: 'approved',
                                        moderatedBy: user.uid,
                                        moderatedAt: new Date()
                                    });
                                    console.log(`Also approved parent thread ${item.threadId}`);
                                }
                            } catch (threadErr) {
                                console.warn("Could not update parent thread status:", threadErr);
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

            // Only the log entries: the confirmation promises content is kept
            // (this used to delete approved images' files too)
            for (const item of posts) {
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

    if (authLoading || (user && !roleLoaded) || loading) {
        return (
            <div className="min-h-screen bg-ink-950 text-ink-200 flex items-center justify-center font-serif">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-gold-500" />
                    <p>Consulting the Oracle...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink-950 text-ink-200 font-sans selection:bg-gold-900 selection:text-white">
            {/* Header */}
            <header className="bg-ink-900 border-b border-gold-900/30 p-4 sticky top-0 z-10 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 text-ink-400 hover:text-ink-50 hover:bg-ink-800 rounded transition-colors" title="Back to Game">
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-serif font-bold text-gold-100 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-gold-500" />
                            Moderation Dashboard
                        </h1>
                        <span className="text-xs text-ink-500 uppercase tracking-wider">Realm of Allania Admin</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Content Type Selector */}
                    <div className="hidden md:flex items-center bg-ink-800/50 rounded-lg p-1 border border-ink-700/50">
                        {[
                            { value: 'posts', label: 'Posts' },
                            { value: 'codex', label: 'Codex' },
                            { value: 'images', label: 'Images' }
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setContentType(value)}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${contentType === value ? 'bg-indigo-900/50 text-indigo-200 shadow-sm' : 'text-ink-500 hover:text-ink-50 hover:bg-ink-700/50'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    
                    {/* Status Filter */}
                    <div className="hidden md:flex items-center bg-ink-800 rounded-lg p-1 border border-ink-700">
                        {['needs_review', 'rejected', 'approved', 'all'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-all ${filter === s ? 'bg-gold-900/50 text-gold-200 shadow-sm' : 'text-ink-400 hover:text-ink-50 hover:bg-ink-700'}`}
                            >
                                {s === 'needs_review' ? 'Needs Review' : s === 'rejected' ? 'Flagged' : s}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="text-xs text-ink-500 font-mono">
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

                {userRole === 'admin' && <ExternalImagesTool />}

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
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border transition-colors ${contentType === value ? 'bg-indigo-900/20 border-indigo-500 text-indigo-400' : 'bg-ink-900 border-ink-700 text-ink-500'}`}
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
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border transition-colors ${filter === s ? 'bg-gold-900/20 border-gold-500 text-gold-500' : 'bg-ink-900 border-ink-700 text-ink-400'}`}
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
                    <div className="flex flex-col items-center justify-center p-12 text-ink-500 border border-dashed border-ink-800 rounded-lg bg-ink-900/30">
                        <Check className="w-12 h-12 mb-4 text-green-500/50" />
                        <p className="text-lg">No content found in this queue.</p>
                        <p className="text-sm">Great job, Moderator!</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {posts.map(item => (
                            <div key={item.id} className="bg-ink-900 border border-ink-800 rounded-lg p-4 shadow-sm hover:border-ink-700 transition-colors group">
                                <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
                                    {/* Content */}
                                    <div className="flex-1 space-y-2 w-full">
                                        {/* Header with metadata */}
                                        <div className="flex items-center gap-2 text-xs text-ink-500 flex-wrap">
                                            {/* Content Type Icon */}
                                            <span className="flex items-center gap-1">
                                                {contentType === 'posts' && <FileText className="w-3 h-3" />}
                                                {contentType === 'codex' && <BookOpen className="w-3 h-3" />}
                                                {contentType === 'images' && <ImageIcon className="w-3 h-3" />}
                                                <span className="font-mono text-ink-400">{item.id.slice(0, 8)}...</span>
                                            </span>
                                            <span>•</span>
                                            <span>{new Date(item.createdAt?.toDate?.() || item.timestamp?.toDate?.() || item.createdAt || item.timestamp).toLocaleString()}</span>
                                            <span>•</span>
                                            <span className="text-gold-500/80">User: {item.userId || item.creatorId}</span>
                                            {item.moderationMethod && (
                                                <span className={`px-1.5 py-0.5 rounded text-2xs uppercase border ${item.moderationMethod.includes('ai') ? 'border-purple-500/30 text-purple-400' : item.moderationMethod.includes('fallback') ? 'border-orange-500/30 text-orange-400' : 'border-ink-700 text-ink-400'}`}>
                                                    {item.moderationMethod}
                                                </span>
                                            )}
                                            {/* Status Badge */}
                                            <span className={`px-1.5 py-0.5 rounded text-2xs uppercase border ${
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
                                                <div className="bg-black/50 p-3 rounded border border-ink-800/50 text-ink-200">
                                                    <div className="text-xs text-ink-500 mb-1">File Path:</div>
                                    <code className="text-sm break-all">{item.filePath}</code>
                                </div>
                            </div>
                        ) : item.type === 'codex' ? (
                                            <div className="space-y-2">
                                                {item.title && (
                                                    <div className="text-gold-400 font-bold text-lg font-serif">{item.title}</div>
                                                )}
                                                <div className="bg-black/50 p-3 rounded border border-ink-800/50 font-serif text-ink-200 whitespace-pre-wrap max-h-64 overflow-y-auto">
                                                    {item.content}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-black/50 p-3 rounded border border-ink-800/50 font-serif text-ink-200 whitespace-pre-wrap">
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
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-900/20 hover:bg-green-600 text-green-400 hover:text-ink-50 border border-green-900/50 rounded transition-all text-sm font-bold"
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
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-ink-500 hover:text-red-500 hover:bg-ink-800 rounded transition-all text-sm"
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
