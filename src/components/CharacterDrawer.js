import { useState, useCallback } from 'react';
import {
    collection, doc, updateDoc, deleteDoc,
    serverTimestamp, writeBatch, getDocs, query, where, increment
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID, RACES, CLASSES } from '@/lib/constants';
import {
    Shield, ChevronDown, ChevronUp, Edit3, Plus,
    X, Trash2, AlertCircle, AlertTriangle, Loader
} from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';
import CharacterListItem from '@/components/CharacterListItem';

export default function CharacterDrawer() {
    const { user, characters, activeCharId, setActiveCharId } = useGame();

    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState('view');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '', race: RACES[0], class: CLASSES[0], description: '',
        imageUrl: '', imagePosition: 'center'
    });
    const [createCodex, setCreateCodex] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [deleteId, setDeleteId] = useState('');
    const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);
    const [formError, setFormError] = useState('');

    const CHARACTER_LIMIT = 10;
    const atLimit = characters.length >= CHARACTER_LIMIT;

    const resetForm = useCallback(() => {
        setFormData({ name: '', race: RACES[0], class: CLASSES[0], description: '', imageUrl: '', imagePosition: 'center' });
        setCreateCodex(true);
        setFormError('');
        setIsSubmitting(false);
    }, []);

    const openCreator = useCallback(() => {
        if (atLimit) return alert(`You have reached the maximum of ${CHARACTER_LIMIT} characters.`);
        resetForm();
        setMode('create');
    }, [atLimit, resetForm]);

    const openEditor = useCallback((e, char) => {
        e.stopPropagation();
        setEditingId(char.id);
        setFormData({
            name: char.name, race: char.race, class: char.class,
            description: char.description || '',
            imageUrl: char.imageUrl || '',
            imagePosition: char.imagePosition || 'center'
        });
        setMode('edit');
    }, []);

    const openDelete = useCallback((e) => {
        e.stopPropagation();
        setDeleteId(characters.length > 0 ? characters[0].id : '');
        setConfirmDeleteStep(false);
        setMode('delete');
    }, [characters]);

    const handleCreate = async () => {
        if (!formData.name) return setFormError('Name is required');
        if (!user) return setFormError('You must be logged in.');
        if (atLimit) return setFormError('Character limit reached.');

        setIsSubmitting(true);
        setFormError('');

        try {
            const batch = writeBatch(db);

            // 1. Create Character Doc Ref
            const charRef = doc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'characters'));
            batch.set(charRef, { ...formData, createdAt: serverTimestamp() });

            // 2. Increment User Character Count (For Security Rules)
            const userSettingsRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'account');
            batch.update(userSettingsRef, { characterCount: increment(1) });

            // 3. Optional Codex Entry
            if (createCodex) {
                const codexRef = doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'));
                batch.set(codexRef, {
                    title: formData.name,
                    category: 'Characters',
                    content: `**Race:** ${formData.race}\n**Class:** ${formData.class}\n\n${formData.description}`,
                    imageUrl: formData.imageUrl,
                    gallery: formData.imageUrl ? [formData.imageUrl] : [],
                    relatedId: charRef.id,
                    updatedAt: serverTimestamp(),
                    updatedBy: 'System'
                });
            }

            await batch.commit();

            resetForm();
            setMode('view');
            setActiveCharId(charRef.id);

        } catch (e) {
            setFormError(`Error: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        setIsSubmitting(true);
        try {
            // Get the old character data to check for identity changes
            const oldChar = characters.find(c => c.id === editingId);

            const identityChanged = oldChar && (
                oldChar.name !== formData.name ||
                oldChar.race !== formData.race ||
                oldChar.class !== formData.class ||
                oldChar.imageUrl !== formData.imageUrl ||
                oldChar.imagePosition !== formData.imagePosition
            );

            // 1. Update the Character Profile itself
            await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'characters', editingId), formData);

            // 2. IMAGE CLEANUP
            if (oldChar && oldChar.imageUrl && oldChar.imageUrl !== formData.imageUrl) {
                try {
                    if (oldChar.imageUrl.includes('firebasestorage.googleapis.com')) {
                        const oldImageRef = ref(storage, oldChar.imageUrl);
                        await deleteObject(oldImageRef);
                    }
                } catch (delErr) { console.warn("Failed to delete old image:", delErr); }
            }

            // 3. Conditional Bulk Update
            if (identityChanged) {
                const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), where('characterId', '==', editingId));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const chunks = [];
                    const docs = snapshot.docs;

                    for (let i = 0; i < docs.length; i += 450) chunks.push(docs.slice(i, i + 450));

                    for (const chunk of chunks) {
                        const batch = writeBatch(db);
                        chunk.forEach(d => {
                            batch.update(d.ref, {
                                characterImageUrl: formData.imageUrl,
                                characterImagePosition: formData.imagePosition || 'center',
                                characterName: formData.name,
                                characterRace: formData.race,
                                characterClass: formData.class
                            });
                        });
                        await batch.commit();
                    }
                }
            }

            setMode('view');
            setEditingId(null);
        } catch (e) {
            console.error(e);
            setFormError(`Update failed: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const char = characters.find(c => c.id === deleteId);
        if (!char) return;
        setIsSubmitting(true);

        try {
            // --- STEP 1: Anonymize ALL Posts ---
            const postsQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), where('characterId', '==', deleteId));
            const postsSnap = await getDocs(postsQ);

            if (!postsSnap.empty) {
                const chunks = [];
                const docs = postsSnap.docs;
                for (let i = 0; i < docs.length; i += 450) chunks.push(docs.slice(i, i + 450));

                for (const chunk of chunks) {
                    const batch = writeBatch(db);
                    chunk.forEach(d => {
                        batch.update(d.ref, { characterName: `${char.name} [Deleted]`, characterImageUrl: '' });
                    });
                    await batch.commit();
                }
            }

            // --- STEP 2: Mark Codex as Archived ---
            const finalBatch = writeBatch(db);
            const codexQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'), where('relatedId', '==', deleteId));
            const codexSnap = await getDocs(codexQ);
            codexSnap.forEach(d => {
                finalBatch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages', d.id), {
                    title: `[Archived] ${char.name}`, category: 'Lore'
                });
            });

            // --- STEP 3: Delete Character & Decrement Count ---
            finalBatch.delete(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'characters', deleteId));
            const userSettingsRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'account');
            finalBatch.update(userSettingsRef, { characterCount: increment(-1) });

            await finalBatch.commit();

            // --- STEP 4: Image Cleanup ---
            if (char.imageUrl && char.imageUrl.includes('firebasestorage.googleapis.com')) {
                try { await deleteObject(ref(storage, char.imageUrl)); } catch (e) { console.warn("Could not delete image:", e); }
            }

            setMode('view');
            if (activeCharId === deleteId) setActiveCharId(null);

        } catch (e) {
            console.error("Cleanup error:", e);
            setFormError(`Delete failed: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleKey = (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
        }
    };

    return (
        <div className={`fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-amber-700 shadow-[0_-5px_30px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out flex flex-col ${isOpen ? 'h-[80vh] md:h-[500px]' : 'h-14 md:h-16'}`}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={handleToggleKey}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                aria-label={isOpen ? "Close Character Roster" : "Open Character Roster"}
                className="flex items-center justify-between px-6 h-14 md:h-16 shrink-0 cursor-pointer bg-slate-900 hover:bg-slate-800 transition-colors focus:outline-none focus:bg-slate-800"
            >
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-amber-500" />
                    <span className="font-serif font-bold text-amber-100">Character Roster</span>
                    <span className="text-xs text-slate-500 hidden md:inline">|</span>
                    {characters.find(c => c.id === activeCharId) ? (
                        <span className="text-sm text-amber-500 font-bold flex items-center gap-2">Playing as: {characters.find(c => c.id === activeCharId).name}</span>
                    ) : (
                        <span className="text-sm text-slate-500 italic">No character selected</span>
                    )}
                    <span className={`text-[10px] ml-2 px-2 py-0.5 rounded-full ${atLimit ? 'bg-red-900 text-red-200' : 'bg-slate-800 text-slate-400'}`}>
                        {characters.length} / {CHARACTER_LIMIT}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={(e) => openDelete(e)} className="text-slate-500 hover:text-red-500 transition-colors" title="Delete Character" aria-label="Delete Character"><Trash2 className="w-5 h-5" /></button>
                    <div className="text-slate-500 hover:text-amber-500" aria-hidden="true">{isOpen ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-950/50">
                <div className="max-w-5xl mx-auto">
                    {mode === 'view' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {characters.map(char => (
                                <CharacterListItem
                                    key={char.id}
                                    char={char}
                                    isActive={activeCharId === char.id}
                                    onSelect={setActiveCharId}
                                    onEdit={openEditor}
                                />
                            ))}

                            {/* Create Button (Disabled if Limit Reached) */}
                            <button
                                onClick={openCreator}
                                disabled={atLimit}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed transition-all gap-2 h-24 ${atLimit ? 'border-slate-800 text-slate-600 cursor-not-allowed bg-slate-950/50' : 'border-slate-700 text-slate-500 hover:text-amber-500 hover:border-amber-500 hover:bg-slate-900/50'}`}
                            >
                                {atLimit ? (
                                    <><AlertTriangle className="w-6 h-6" /><span className="text-xs font-bold uppercase tracking-wide">Limit Reached</span></>
                                ) : (
                                    <><Plus className="w-6 h-6" /><span className="text-xs font-bold uppercase tracking-wide">New Character</span></>
                                )}
                            </button>
                        </div>
                    )}
                    {(mode === 'create' || mode === 'edit') && (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 relative">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-amber-100 font-bold flex items-center gap-2">{mode === 'create' ? <><Plus className="w-4 h-4" /> Create Identity</> : <><Edit3 className="w-4 h-4" /> Edit Identity</>}</h3>
                                <button onClick={() => setMode('view')}><X className="w-5 h-5 text-slate-500" /></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div><label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Name</label><input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:border-amber-500 focus:outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Race</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:border-amber-500 focus:outline-none" value={formData.race} onChange={e => setFormData({ ...formData, race: e.target.value })}>{RACES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                                        <div><label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Class</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:border-amber-500 focus:outline-none" value={formData.class} onChange={e => setFormData({ ...formData, class: e.target.value })}>{CLASSES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    </div>

                                    {/* Image Uploader */}
                                    <div className="p-4 bg-slate-950 rounded border border-slate-800">
                                        <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Portrait</label>
                                        <ImageUploader
                                            initialUrl={formData.imageUrl}
                                            initialPosition={formData.imagePosition}
                                            folder="character_portraits"
                                            shape="circle"
                                            onImageChanged={(url, pos) => setFormData(prev => ({ ...prev, imageUrl: url, imagePosition: pos }))}
                                        />
                                    </div>

                                </div>
                                <div className="flex flex-col h-full">
                                    <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Description</label>
                                    <textarea className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:border-amber-500 focus:outline-none text-sm resize-none mb-4" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                    {mode === 'create' && (<div className="flex items-center gap-2 mb-4"><input type="checkbox" checked={createCodex} onChange={e => setCreateCodex(e.target.checked)} className="w-4 h-4" /><label className="text-sm text-slate-400">Create Codex Entry?</label></div>)}
                                    <div className="flex justify-end gap-3"><button onClick={() => setMode('view')} className="text-slate-400 hover:text-white px-3">Cancel</button><button onClick={mode === 'create' ? handleCreate : handleUpdate} disabled={isSubmitting} className="bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2">{isSubmitting && <Loader className="w-4 h-4 animate-spin" />} {mode === 'create' ? 'Summon' : 'Save Changes'}</button></div>
                                </div>
                            </div>
                            {formError && <p className="text-red-500 text-xs mt-2 absolute bottom-6 left-6 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {formError}</p>}
                        </div>
                    )}
                    {mode === 'delete' && (
                        <div className="bg-slate-900 border border-red-900/50 rounded-xl p-6">
                            <div className="flex justify-between items-center mb-6"><h3 className="text-red-400 font-bold flex items-center gap-2"><Trash2 className="w-5 h-5" /> Delete Character</h3><button onClick={() => setMode('view')}><X className="w-5 h-5 text-slate-500" /></button></div>
                            <div className="bg-red-950/30 border border-red-900 rounded p-4 flex flex-col items-center text-center">
                                <AlertTriangle className="w-12 h-12 text-red-500 mb-2" />
                                {!confirmDeleteStep ? (
                                    <>
                                        <p className="text-slate-300 text-sm mb-4">Select a character to permanently delete.</p>
                                        <div className="flex gap-3 w-full max-w-md"><select className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:border-red-500 focus:outline-none" value={deleteId} onChange={(e) => setDeleteId(e.target.value)}><option value="">-- Select --</option>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button onClick={() => setConfirmDeleteStep(true)} disabled={!deleteId} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded">Delete</button></div>
                                    </>
                                ) : (
                                    <><h4 className="text-red-200 font-bold text-lg mb-1">Are you sure?</h4><p className="text-slate-400 text-sm mb-4">This action cannot be undone.</p><div className="flex gap-3"><button onClick={() => setConfirmDeleteStep(false)} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button><button onClick={handleDelete} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2">{isSubmitting && <Loader className="w-4 h-4 animate-spin" />} Yes, Delete</button></div></>
                                )}
                                {formError && <p className="text-red-400 text-xs mt-4">{formError}</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}