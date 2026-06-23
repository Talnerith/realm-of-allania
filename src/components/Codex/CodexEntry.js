import { useState, useEffect } from 'react';
import { ChevronLeft, Edit3, Save, Trash2, Image as ImageIcon, X, ChevronRight, Plus, AlertCircle, Lock, Unlock, BookLock } from 'lucide-react';
import { doc, updateDoc, addDoc, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID, CATEGORIES } from '@/lib/constants';
import ImageUploader from '@/components/ImageUploader';
import MarkdownEditor from '@/components/MarkdownEditor';
import RichText from '@/components/RichText';

// Helper for timestamp
const formatTime = (ts) => {
    if (!ts?.toDate) return 'Just now';
    return ts.toDate().toLocaleString();
};

export default function CodexEntry({ page, goBack, onWikiLink }) {
    const { user, characters, activeCharId, userRole } = useGame();

    // State
    const [isEditing, setIsEditing] = useState(page.isNew || false);
    const [title, setTitle] = useState(page.title || '');
    const [category, setCategory] = useState(page.category || 'General');
    const [content, setContent] = useState(page.content || '');
    const [gallery, setGallery] = useState(page.gallery || []);
    const [error, setError] = useState('');

    // Staging state for the Image Uploader
    const [stagedUrl, setStagedUrl] = useState('');

    // Track session uploads for cleanup on cancel
    const [sessionUploads, setSessionUploads] = useState([]);

    // Local copy to prevent flicker when saving
    const [localPage, setLocalPage] = useState(page);

    // Lightbox
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // Permission Check
    const isAdminOrMod = userRole === 'admin' || userRole === 'moderator';
    const isLocked = localPage.isLocked === true;
    const canEdit = isAdminOrMod || !isLocked;
    const canLock = isAdminOrMod;


    const handleSave = async () => {
        setError('');
        if (!user) return setError("You must be signed in to save.");
        if (!title.trim() || title.length < 3) return setError("Title must be at least 3 characters.");
        if (!content.trim() || content.length < 10) return setError("Content must be at least 10 characters.");
        if (gallery.length > 5) return setError("Gallery cannot exceed 5 images.");

        // Determine status based on user role
        const isTrusted = userRole === 'trusted' || userRole === 'moderator' || userRole === 'admin';
        const status = isTrusted ? 'approved' : 'pending';

        const pageData = {
            title, category, content, gallery,
            updatedAt: serverTimestamp(),
            updatedBy: characters.find(c => c.id === activeCharId)?.name || 'Anonymous',
            lastEditorId: user.uid,
            status: status
        };

        try {
            if (localPage.isNew) {
                // Create
                const ref = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'), {
                    ...pageData,
                    relatedId: localPage.relatedId || '',
                    creatorId: user.uid,
                    createdAt: serverTimestamp()
                });
                setLocalPage({ ...pageData, id: ref.id, updatedAt: { toDate: () => new Date() } });
                if (!isTrusted) {
                    alert("Your codex entry has been submitted for moderation. It will be reviewed shortly.");
                }
            } else {
                // Update
                await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages', localPage.id), pageData);
                setLocalPage(prev => ({ ...prev, ...pageData, updatedAt: { toDate: () => new Date() } }));
            }
            setSessionUploads([]); // Clear session tracking on success
            setIsEditing(false);
        } catch (e) {
            console.error(e);
            setError("Save failed: " + e.message);
        }
    };

    const handleCancel = async () => {
        // Cleanup orphaned session uploads
        for (const url of sessionUploads) {
            try {
                const fileRef = ref(storage, url);
                await deleteObject(fileRef);
            } catch (e) {
                console.log("Cleanup: File already gone or failed", url);
            }
        }
        setSessionUploads([]);
        setStagedUrl('');
        if (localPage.isNew) goBack(); else setIsEditing(false);
    };

    const handleDelete = async () => {
        if (!isAdminOrMod) return;
        if (!window.confirm("Are you sure you want to delete this Codex Entry? This cannot be undone.")) return;

        try {
            // CLEANUP: Delete all gallery images associated with this page
            if (localPage.gallery && localPage.gallery.length > 0) {
                for (const url of localPage.gallery) {
                    if (url.includes('firebasestorage')) {
                        try { await deleteObject(ref(storage, url)); } catch (e) { console.warn("Cleanup failed:", e); }
                    }
                }
            }

            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages', localPage.id));
            goBack();
        } catch (e) {
            console.error("Delete failed:", e);
            alert("Failed to delete. You may not have permission.");
        }
    };

    const handleToggleLock = async () => {
        if (!isAdminOrMod) return;
        const newLockState = !isLocked;
        const action = newLockState ? 'lock' : 'unlock';
        if (!window.confirm(`Are you sure you want to ${action} this codex page as a Sacred Text? ${newLockState ? 'Regular users will not be able to edit this page.' : 'Regular users will be able to edit this page again.'}`)) return;
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages', localPage.id), { 
                isLocked: newLockState,
                lockedAt: newLockState ? serverTimestamp() : null,
                lockedBy: newLockState ? user.uid : null
            });
            setLocalPage(prev => ({ ...prev, isLocked: newLockState }));
        } catch (e) { 
            console.error(e); 
            alert("Failed to update lock status.");
        }
    };

    // Gallery Handlers
    const handleStagedImage = (url) => {
        setStagedUrl(url);
        setSessionUploads(prev => [...prev, url]);
    };

    const addStagedToGallery = () => {
        if (gallery.length >= 5) {
            setError("Maximum 5 images allowed in gallery.");
            return;
        }
        if (stagedUrl && !gallery.includes(stagedUrl)) {
            setGallery([...gallery, stagedUrl]);
            setStagedUrl('');
            setError('');
        }
    };

    const removeImage = async (url) => {
        // Remove from UI immediately
        setGallery(gallery.filter(u => u !== url));

        if (url.includes('firebasestorage')) {
            try { await deleteObject(ref(storage, url)); } catch (e) { console.warn("Cleanup failed:", e); }
        }
    };

    // Lightbox Handlers
    const openLightbox = (idx) => { setLightboxIndex(idx); setLightboxOpen(true); };
    const nextImage = (e) => { e.stopPropagation(); setLightboxIndex((i) => (i + 1) % gallery.length); };
    const prevImage = (e) => { e.stopPropagation(); setLightboxIndex((i) => (i - 1 + gallery.length) % gallery.length); };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-950">
            <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in slide-in-from-right-8 pb-32">
                {/* Lightbox */}
                {lightboxOpen && (
                    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
                        <button className="absolute top-4 right-4 text-white hover:text-amber-500"><X className="w-8 h-8" /></button>
                        <img src={gallery[lightboxIndex]} alt="Gallery Viewer" className="max-w-full max-h-full object-contain select-none" onClick={(e) => e.stopPropagation()} onError={(e) => { e.target.src = 'https://placehold.co/800x600/1e293b/FFF?text=Error'; }} />
                        {gallery.length > 1 && (
                            <>
                                <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 text-white"><ChevronLeft className="w-10 h-10" /></button>
                                <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 text-white"><ChevronRight className="w-10 h-10" /></button>
                            </>
                        )}
                    </div>
                )}

                {/* Header Controls */}
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={goBack} className="text-slate-400 hover:text-white flex items-center gap-1">
                        <ChevronLeft className="w-5 h-5" /> Back to Index
                    </button>
                    <div className="flex-1"></div>

                    {/* DELETE BUTTON (Admin/Mod Only) */}
                    {!isEditing && !page.isNew && isAdminOrMod && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 text-red-900 hover:text-red-500 px-3 py-1 mr-2 transition-colors border border-transparent hover:border-red-900/30 rounded"
                            title="Delete Entry"
                        >
                            <Trash2 className="w-4 h-4" /> <span className="hidden md:inline text-xs font-bold uppercase">Delete</span>
                        </button>
                    )}

                    {/* LOCK BUTTON (Admin/Mod Only) */}
                    {!isEditing && !page.isNew && canLock && (
                        <button
                            onClick={handleToggleLock}
                            className={`flex items-center gap-2 px-3 py-1 mr-2 transition-colors border rounded ${isLocked ? 'text-amber-500 border-amber-900/30 hover:border-amber-700/50' : 'text-slate-500 border-transparent hover:text-amber-500 hover:border-amber-900/30'}`}
                            title={isLocked ? "Unlock Page" : "Lock as Sacred Text"}
                        >
                            {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            <span className="hidden md:inline text-xs font-bold uppercase">{isLocked ? 'Unlock' : 'Lock'}</span>
                        </button>
                    )}

                    {!isEditing ? (
                        canEdit ? (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-slate-800 text-slate-200 px-3 py-1 rounded hover:bg-slate-700">
                                <Edit3 className="w-4 h-4" /> Edit Page
                            </button>
                        ) : (
                            <span className="flex items-center gap-2 px-3 py-1 bg-amber-900/20 border border-amber-700/50 rounded text-amber-400 text-sm">
                                <BookLock className="w-4 h-4" /> Sacred Text
                            </span>
                        )
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={handleCancel} className="text-slate-400 hover:text-white">Cancel</button>
                            <button onClick={handleSave} className="flex items-center gap-2 bg-amber-700 text-white px-3 py-1 rounded hover:bg-amber-600">
                                <Save className="w-4 h-4" /> Save Changes
                            </button>
                        </div>
                    )}
                </div>

                {/* Content Card */}
                <div className="bg-slate-900 border border-amber-900/30 rounded-xl overflow-hidden shadow-2xl relative">

                    {/* Error Banner */}
                    {error && (
                        <div className="absolute top-0 left-0 right-0 bg-red-900/90 text-white p-2 text-center text-sm font-bold z-50 animate-in slide-in-from-top flex items-center justify-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    {/* Title Area */}
                    <div className="h-32 bg-linear-to-r from-amber-900/20 to-slate-900 border-b border-amber-900/30 p-6 flex items-end">
                        <div className="w-full">
                            {isEditing ? (
                                <div className="flex flex-col gap-2">
                                    <select className="bg-slate-950/50 border border-amber-900/50 text-amber-500 text-xs font-bold uppercase rounded p-1" value={category} onChange={e => setCategory(e.target.value)}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <input className="bg-transparent border-b border-amber-900/50 text-3xl font-serif font-bold text-amber-100 w-full focus:outline-none focus:border-amber-500" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" />
                                </div>
                            ) : (
                                <>
                                    <div className="text-amber-500 text-xs font-bold uppercase mb-1">{category}</div>
                                    <h1 className="text-4xl font-serif font-bold text-amber-100">{title}</h1>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="p-8">
                        {isEditing ? (
                            <div className="space-y-6">
                                {/* MARKDOWN EDITOR REPLACES TEXTAREA */}
                                <MarkdownEditor
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    placeholder="Write your lore (Min 10 characters)..."
                                    minHeight="min-h-[400px]"
                                    onWikiLink={onWikiLink}
                                />
                                <div className="text-right text-[10px] text-slate-500">{content.length} / 10000 chars</div>

                                {/* Gallery Editor */}
                                <div className="bg-slate-950 p-4 rounded border border-slate-800">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-amber-500 font-bold flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Gallery Manager</h4>
                                        <span className={`text-xs font-bold ${gallery.length >= 5 ? 'text-red-500' : 'text-slate-500'}`}>{gallery.length}/5 Images</span>
                                    </div>

                                    {/* Image Uploader Integration */}
                                    {gallery.length < 5 && (
                                        <div className="mb-6 bg-slate-900/50 p-4 rounded border border-slate-800">
                                            <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Add New Image</label>
                                            <ImageUploader
                                                initialUrl={stagedUrl}
                                                onImageChanged={handleStagedImage}
                                                folder="codex_gallery"
                                                shape="square"
                                            />
                                            <div className="mt-3 flex justify-end">
                                                <button
                                                    onClick={addStagedToGallery}
                                                    disabled={!stagedUrl}
                                                    className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm flex items-center gap-2"
                                                >
                                                    <Plus className="w-4 h-4" /> Add to Gallery
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-4 gap-2">
                                        {gallery.map((url, idx) => (
                                            <div key={idx} className="relative aspect-square rounded overflow-hidden border border-slate-700 group">
                                                <img src={url} alt={`Gallery Image ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://placehold.co/400x400/1e293b/FFF?text=Error'; }} />
                                                <button onClick={() => removeImage(url)} className="absolute top-1 right-1 bg-red-900/80 text-white p-1 rounded-full"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        ))}
                                        {gallery.length === 0 && <p className="col-span-4 text-center text-slate-500 text-sm italic py-4">No images in gallery yet.</p>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="prose prose-invert prose-amber max-w-none whitespace-pre-wrap font-serif text-lg text-slate-300 mb-8">
                                    <RichText content={content} onWikiLink={onWikiLink} />
                                </div>

                                {/* View Mode Gallery */}
                                {gallery.length > 0 && (
                                    <div className="border-t border-slate-800 pt-8 mt-8">
                                        <h3 className="text-amber-100 font-bold mb-4 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-amber-500" /> Gallery</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {gallery.map((url, idx) => (
                                                <div key={idx} onClick={() => openLightbox(idx)} className="aspect-square rounded border border-slate-700 overflow-hidden cursor-pointer hover:border-amber-500">
                                                    <img src={url} alt={`Gallery Image ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" onError={(e) => { e.target.src = 'https://placehold.co/400x400/1e293b/FFF?text=Error'; }} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-8 pt-8 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
                                    <span>Updated by <span className="text-amber-500">{localPage.updatedBy}</span></span>
                                    <span>{formatTime(localPage.updatedAt)}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}