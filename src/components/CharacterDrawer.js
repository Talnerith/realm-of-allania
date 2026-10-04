import { useState, useCallback } from 'react';
import {
    collection, doc, updateDoc,
    serverTimestamp, writeBatch, increment
} from 'firebase/firestore';
import { nameProblem, containsForbiddenText } from '@/lib/moderation/textRules';
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
    const { user, userRole, characters, activeCharId, setActiveCharId } = useGame();

    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState('view');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '', race: RACES[0], class: CLASSES[0], description: '',
        imageUrl: '', imagePosition: 'center'
    });
    const [sessionUploads, setSessionUploads] = useState([]);
    const [createCodex, setCreateCodex] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [deleteId, setDeleteId] = useState('');
    const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);
    const [formError, setFormError] = useState('');

    const CHARACTER_LIMIT = 10;
    const atLimit = characters.length >= CHARACTER_LIMIT;

    const resetForm = useCallback(() => {
        setFormData({ name: '', race: RACES[0], class: CLASSES[0], description: '', imageUrl: '', imagePosition: 'center' });
        setSessionUploads([]);
        setCreateCodex(true);
        setFormError('');
        setIsSubmitting(false);
    }, []);

    const handleCancel = async () => {
        // Cleanup orphaned uploads
        for (const url of sessionUploads) {
            try {
                const fileRef = ref(storage, url);
                await deleteObject(fileRef);
            } catch (e) {
                // Ignore errors (file might be already deleted by ImageUploader or never existed)
                console.log("Cleanup: File already gone or failed", url);
            }
        }
        resetForm();
        setMode('view');
    };

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

    // Same checks the rules enforce, so players get a clear message
    const profileProblem = () => {
        const problem = nameProblem(formData.name, { allowReserved: userRole === 'admin' || userRole === 'moderator' });
        if (problem) return problem;
        if ([formData.race, formData.class, formData.description].some(containsForbiddenText)) {
            return 'The profile contains a blocked word.';
        }
        if (formData.name.length > 60) return 'Name must be 60 characters or fewer.';
        if ((formData.description || '').length > 5000) return 'Description must be 5000 characters or fewer.';
        return null;
    };

    const handleCreate = async () => {
        if (!formData.name) return setFormError('Name is required');
        const problem = profileProblem();
        if (problem) return setFormError(problem);
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
                    creatorId: user.uid,
                    lastEditorId: user.uid,
                    updatedAt: serverTimestamp(),
                    updatedBy: 'System',
                    // Required by rules; without it the whole character batch is denied.
                    // The moderation function auto-approves trusted users.
                    status: 'pending'
                });
            }

            await batch.commit();

            setSessionUploads([]); // clear list so we don't delete valid images
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
        const problem = profileProblem();
        if (problem) return setFormError(problem);
        setIsSubmitting(true);
        try {
            const oldChar = characters.find(c => c.id === editingId);

            // 1. Update the Character Profile itself. The syncCharacter Cloud
            // Function copies name/race/class/portrait changes onto every post
            // and thread written as this character.
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

            setSessionUploads([]); // clear list so we don't delete valid images
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
            // Posts and threads are marked "[Deleted]" and the character's codex
            // page archived by the syncCharacter Cloud Function, server-side.
            const finalBatch = writeBatch(db);

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
        <div className={`fixed bottom-0 left-0 right-0 z-50 bg-ink-900 border-t border-gold-700/50 shadow-[0_-5px_30px_rgba(0,0,0,0.5)] light:shadow-[0_-8px_30px_-12px_oklch(30%_.03_60/.25)] transition-all duration-300 ease-in-out flex flex-col ${isOpen ? 'h-[80vh] md:h-[500px]' : 'h-14 md:h-16'}`}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={handleToggleKey}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                aria-label={isOpen ? "Close Character Roster" : "Open Character Roster"}
                className="flex items-center justify-between gap-3 px-6 max-[520px]:px-4 h-14 md:h-16 shrink-0 cursor-pointer bg-ink-900 hover:bg-ink-800 transition-colors focus:outline-none focus:bg-ink-800"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <Shield className="w-5 h-5 text-gold-500 shrink-0" aria-hidden="true" />
                    <span className="font-serif font-bold text-gold-100 shrink-0 max-[520px]:hidden">Character Roster</span>
                    <span className="text-xs text-ink-500 hidden md:inline" aria-hidden="true">|</span>
                    {characters.find(c => c.id === activeCharId) ? (
                        <span className="text-sm text-gold-500 font-bold truncate">Playing as: {characters.find(c => c.id === activeCharId).name}</span>
                    ) : (
                        <span className="text-sm text-ink-500 italic truncate">No character selected</span>
                    )}
                    <span className={`text-2xs ml-2 px-2 py-0.5 rounded-full shrink-0 max-[520px]:hidden ${atLimit ? 'bg-red-900 text-red-200' : 'bg-ink-800 text-ink-400'}`}>
                        {characters.length} / {CHARACTER_LIMIT}
                    </span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <button onClick={(e) => openDelete(e)} className="text-ink-500 hover:text-red-500 transition-colors" title="Delete Character" aria-label="Delete Character"><Trash2 className="w-5 h-5" /></button>
                    <div className="text-ink-500 hover:text-gold-500" aria-hidden="true">{isOpen ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-ink-950/50">
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
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed transition-all gap-2 h-24 ${atLimit ? 'border-ink-800 text-ink-600 cursor-not-allowed bg-ink-950/50' : 'border-ink-700 text-ink-500 hover:text-gold-500 hover:border-gold-500 hover:bg-ink-900/50'}`}
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
                        <div className="bg-ink-900 border border-ink-700 rounded-xl p-6 relative">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-gold-100 font-bold flex items-center gap-2">{mode === 'create' ? <><Plus className="w-4 h-4" /> Create Identity</> : <><Edit3 className="w-4 h-4" /> Edit Identity</>}</h3>
                                <button onClick={() => setMode('view')}><X className="w-5 h-5 text-ink-500" /></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div><label className="text-xs text-ink-500 uppercase font-bold mb-1 block">Name</label><input className="w-full bg-ink-950 border border-ink-700 rounded p-2 text-ink-100 focus:border-gold-500 focus:outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs text-ink-500 uppercase font-bold mb-1 block">Race</label><select className="w-full bg-ink-950 border border-ink-700 rounded p-2 text-ink-100 focus:border-gold-500 focus:outline-none" value={formData.race} onChange={e => setFormData({ ...formData, race: e.target.value })}>{RACES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                                        <div><label className="text-xs text-ink-500 uppercase font-bold mb-1 block">Class</label><select className="w-full bg-ink-950 border border-ink-700 rounded p-2 text-ink-100 focus:border-gold-500 focus:outline-none" value={formData.class} onChange={e => setFormData({ ...formData, class: e.target.value })}>{CLASSES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    </div>

                                    {/* Image Uploader */}
                                    <div className="p-4 bg-ink-950 rounded border border-ink-800">
                                        <label className="text-xs text-ink-500 uppercase font-bold mb-2 block">Portrait</label>
                                        <ImageUploader
                                            initialUrl={formData.imageUrl}
                                            initialPosition={formData.imagePosition}
                                            folder="character_portraits"
                                            shape="circle"
                                            onImageChanged={(url, pos) => {
                                                setFormData(prev => ({ ...prev, imageUrl: url, imagePosition: pos }));
                                                setSessionUploads(prev => [...prev, url]);
                                            }}
                                        />
                                    </div>

                                </div>
                                <div className="flex flex-col h-full">
                                    <label className="text-xs text-ink-500 uppercase font-bold mb-1 block">Description</label>
                                    <textarea className="flex-1 bg-ink-950 border border-ink-700 rounded p-2 text-ink-100 focus:border-gold-500 focus:outline-none text-sm resize-none mb-4" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                    {mode === 'create' && (<div className="flex items-center gap-2 mb-4"><input type="checkbox" checked={createCodex} onChange={e => setCreateCodex(e.target.checked)} className="w-4 h-4" /><label className="text-sm text-ink-400">Create Codex Entry?</label></div>)}
                                    <div className="flex justify-end gap-3"><button onClick={handleCancel} className="text-ink-400 hover:text-ink-50 px-3">Cancel</button><button onClick={mode === 'create' ? handleCreate : handleUpdate} disabled={isSubmitting} className="bg-gold-700 hover:bg-gold-600 disabled:bg-ink-700 text-white px-4 py-2 rounded flex items-center gap-2">{isSubmitting && <Loader className="w-4 h-4 animate-spin" />} {mode === 'create' ? 'Summon' : 'Save Changes'}</button></div>
                                </div>
                            </div>
                            {formError && <p className="text-red-500 text-xs mt-2 absolute bottom-6 left-6 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {formError}</p>}
                        </div>
                    )}
                    {mode === 'delete' && (
                        <div className="bg-ink-900 border border-red-900/50 rounded-xl p-6">
                            <div className="flex justify-between items-center mb-6"><h3 className="text-red-400 font-bold flex items-center gap-2"><Trash2 className="w-5 h-5" /> Delete Character</h3><button onClick={() => setMode('view')}><X className="w-5 h-5 text-ink-500" /></button></div>
                            <div className="bg-red-950/30 border border-red-900 rounded p-4 flex flex-col items-center text-center">
                                <AlertTriangle className="w-12 h-12 text-red-500 mb-2" />
                                {!confirmDeleteStep ? (
                                    <>
                                        <p className="text-ink-300 text-sm mb-4">Select a character to permanently delete.</p>
                                        <div className="flex gap-3 w-full max-w-md"><select className="flex-1 bg-ink-950 border border-ink-700 rounded p-2 text-ink-100 focus:border-red-500 focus:outline-none" value={deleteId} onChange={(e) => setDeleteId(e.target.value)}><option value="">-- Select --</option>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button onClick={() => setConfirmDeleteStep(true)} disabled={!deleteId} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded">Delete</button></div>
                                    </>
                                ) : (
                                    <><h4 className="text-red-200 font-bold text-lg mb-1">Are you sure?</h4><p className="text-ink-400 text-sm mb-4">This action cannot be undone.</p><div className="flex gap-3"><button onClick={() => setConfirmDeleteStep(false)} className="px-4 py-2 text-ink-300 hover:text-ink-50">Cancel</button><button onClick={handleDelete} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2">{isSubmitting && <Loader className="w-4 h-4 animate-spin" />} Yes, Delete</button></div></>
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