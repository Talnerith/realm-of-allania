import { useState, useCallback, useEffect } from 'react';
import {
    collection, doc, updateDoc,
    serverTimestamp, writeBatch, increment
} from 'firebase/firestore';
import { nameProblem, containsForbiddenText } from '@/lib/moderation/textRules';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID, RACES, CLASSES } from '@/lib/constants';
import { ChevronUp, Plus, X, Trash2, AlertTriangle, Loader } from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';
import CharacterListItem from '@/components/CharacterListItem';
import { Gem, GoldRule } from '@/components/Ornaments';
import { ROSTER_BANNER_IMG, EDIT_PEN_IMG } from '@/lib/artAssets';

const CHARACTER_LIMIT = 10;

const labelCls = 'text-xs uppercase tracking-widest font-bold text-ink-400';
const fieldCls = 'w-full bg-ink-950 border border-ink-700 rounded px-3 py-2 text-base text-ink-50 focus:border-gold-500 focus:outline-none';
const cancelBtnCls = 'rounded border border-ink-700 px-4 py-2 text-ink-200 hover:border-gold-700 hover:text-gold-300 transition-colors';
const closeBtnCls = 'p-2 rounded-full text-ink-400 hover:text-ink-50 hover:bg-ink-800 transition-colors';
const errorCls = 'text-sm text-red-400 bg-red-950 border border-red-900 rounded px-3 py-2';

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
    // The portrait the character already has; never one of this session's uploads
    const [savedImageUrl, setSavedImageUrl] = useState('');
    const [createCodex, setCreateCodex] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [deleteId, setDeleteId] = useState('');
    const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);
    const [formError, setFormError] = useState('');

    const atLimit = characters.length >= CHARACTER_LIMIT;

    const resetForm = useCallback(() => {
        setFormData({ name: '', race: RACES[0], class: CLASSES[0], description: '', imageUrl: '', imagePosition: 'center' });
        setSessionUploads([]);
        setSavedImageUrl('');
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
        setEditingId(null);
        setMode('view');
    };

    // Also called when the focus point is dragged, with the current image, so
    // only remember images this session uploaded (Cancel deletes those)
    const handleImageChanged = useCallback((url, pos) => {
        setFormData(prev => ({ ...prev, imageUrl: url, imagePosition: pos }));
        if (url && url !== savedImageUrl) setSessionUploads(prev => prev.includes(url) ? prev : [...prev, url]);
    }, [savedImageUrl]);

    const openCreator = useCallback(() => {
        if (atLimit) return;
        resetForm();
        setMode('create');
    }, [atLimit, resetForm]);

    const openEditor = useCallback((e, char) => {
        e.stopPropagation();
        setFormError('');
        setSessionUploads([]);
        setSavedImageUrl(char.imageUrl || '');
        setEditingId(char.id);
        setFormData({
            name: char.name, race: char.race, class: char.class,
            description: char.description || '',
            imageUrl: char.imageUrl || '',
            imagePosition: char.imagePosition || 'center'
        });
        setMode('edit');
    }, []);

    // The bar's trash button opens the drawer straight into the delete flow
    const openDelete = useCallback((e) => {
        e.stopPropagation();
        setDeleteId(characters.length > 0 ? characters[0].id : '');
        setConfirmDeleteStep(false);
        setFormError('');
        setMode('delete');
        setIsOpen(true);
    }, [characters]);

    const backToRoster = () => {
        setConfirmDeleteStep(false);
        setFormError('');
        setMode('view');
    };

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
        if (!formData.name.trim()) return setFormError('Name is required.');
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
            // 1. Update the Character Profile itself. The syncCharacter Cloud
            // Function copies name/race/class/portrait changes onto every post
            // and thread written as this character.
            await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'characters', editingId), formData);

            // The old portrait isn't deleted here: the character's codex page and
            // gallery use the same file. The weekly orphaned-image cleanup removes
            // it once nothing mentions it.

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

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (mode === 'create') handleCreate();
        else handleUpdate();
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

            // The portrait stays: the archived codex page still shows it (the
            // weekly orphaned-image cleanup removes it once nothing does)

            setMode('view');
            setConfirmDeleteStep(false);
            if (activeCharId === deleteId) setActiveCharId(null);

        } catch (e) {
            console.error("Cleanup error:", e);
            setFormError(`Delete failed: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Escape closes the open drawer
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen]);

    const handleToggleKey = (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
        }
    };

    const activeChar = characters.find(c => c.id === activeCharId);
    const deleteChar = characters.find(c => c.id === deleteId);
    const isForm = mode === 'create' || mode === 'edit';

    return (
        <>
            {isOpen && <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsOpen(false)} aria-hidden="true" />}

            <div className={`fixed bottom-0 inset-x-0 z-50 flex flex-col bg-ink-950 shadow-2xl transition-[height] duration-300 ease-in-out ${isOpen ? 'h-[80vh] md:h-[500px]' : 'h-14 md:h-16'}`}>
                {/* Top edge: double gold rule with a centre gem */}
                <div className="absolute inset-x-0 top-0 border-t border-gold-600 pointer-events-none" />
                <div className="absolute inset-x-0 top-1 border-t border-gold-900 pointer-events-none" />
                <Gem size={22} style={{ left: 'calc(50% - 11px)', top: -11 }} />

                {/* Emblem: vertically centred on the bar, so it overhangs it equally above and below */}
                <img
                    src={ROSTER_BANNER_IMG.src}
                    srcSet={ROSTER_BANNER_IMG.srcSet}
                    alt=""
                    className="absolute z-[3] w-auto pointer-events-none left-[clamp(.5rem,1.5vw,1.25rem)] h-(--roster-emblem-h) top-[calc((60px-var(--roster-emblem-h))/2)] md:top-[calc((68px-var(--roster-emblem-h))/2)] drop-shadow-[0_4px_6px_rgb(0_0_0/.5)]"
                    style={{ '--roster-emblem-h': 'clamp(76px, calc(68px + .9vw), 94px)' }}
                />

                <div
                    onClick={() => setIsOpen(!isOpen)}
                    onKeyDown={handleToggleKey}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Close Character Roster" : "Open Character Roster"}
                    className="shrink-0 h-14 md:h-16 pt-1 pl-[6.5rem] md:pl-32 pr-3 md:pr-6 flex items-center gap-3 cursor-pointer hover:bg-ink-900 focus:bg-ink-900 focus:outline-none transition-colors"
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="font-serif font-bold text-gold-100 text-xl shrink-0 hidden md:inline">Character Roster</span>
                        <span className="text-ink-500 hidden md:inline" aria-hidden="true">|</span>
                        {activeChar ? (
                            <span className="text-sm truncate min-w-0">
                                <span className="text-ink-400">Playing as: </span>
                                <span className="font-serif font-bold text-gold-500 text-lg">{activeChar.name}</span>
                            </span>
                        ) : (
                            <span className="text-sm italic text-ink-400 truncate">No character selected</span>
                        )}
                        <span className={`shrink-0 rounded-full border text-2xs font-bold px-2 py-0.5 ${atLimit ? 'bg-red-950 border-red-900 text-red-400' : 'bg-ink-800 border-ink-700 text-ink-300'}`}>
                            {characters.length} / {CHARACTER_LIMIT}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                        <button type="button" onClick={openDelete} className="p-2 rounded-full text-ink-400 hover:text-red-400 hover:bg-ink-800 transition-colors" title="Delete character" aria-label="Delete character">
                            <Trash2 className="w-5 h-5" aria-hidden="true" />
                        </button>
                        <span className={`p-1 flex text-gold-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                            <ChevronUp className="w-6 h-6" />
                        </span>
                    </div>
                </div>

                {isOpen && (
                    <>
                        <GoldRule gap={3} />

                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 md:px-6 py-5 md:py-6">
                            <div className="max-w-6xl mx-auto">
                                {mode === 'view' && (
                                    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                                        {characters.map(char => (
                                            <li key={char.id}>
                                                <CharacterListItem
                                                    char={char}
                                                    isActive={activeCharId === char.id}
                                                    onSelect={setActiveCharId}
                                                    onEdit={openEditor}
                                                />
                                            </li>
                                        ))}
                                        <li className="aspect-[2.2/1]">
                                            {atLimit ? (
                                                <button type="button" disabled className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-lg text-ink-400 bg-ink-900/50 cursor-not-allowed border-[1.5px] border-dashed border-ink-700">
                                                    <AlertTriangle className="w-7 h-7" strokeWidth={1.8} aria-hidden="true" />
                                                    <span className="font-serif uppercase text-base md:text-lg tracking-[.18em]">Limit Reached</span>
                                                    <span className="text-xs text-ink-400">{CHARACTER_LIMIT} of {CHARACTER_LIMIT} characters</span>
                                                </button>
                                            ) : (
                                                <button type="button" onClick={openCreator} className="w-full h-full flex flex-col items-center justify-center gap-3 rounded-lg text-gold-500 hover:text-gold-300 hover:bg-ink-900 transition-colors border-[1.5px] border-dashed border-gold-700">
                                                    <span className="flex items-center gap-4 w-full justify-center" aria-hidden="true">
                                                        <span className="h-px w-[28%] bg-linear-to-r from-transparent to-gold-700" />
                                                        <Plus className="w-9 h-9" strokeWidth={2} strokeLinecap="square" />
                                                        <span className="h-px w-[28%] bg-linear-to-r from-gold-700 to-transparent" />
                                                    </span>
                                                    <span className="font-serif uppercase text-base md:text-lg tracking-[.18em]">New Character</span>
                                                </button>
                                            )}
                                        </li>
                                    </ul>
                                )}

                                {isForm && (
                                    <form onSubmit={handleSubmit} noValidate className="relative bg-ink-900 border border-gold-900 rounded-xl p-5 md:p-7 flex flex-col gap-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="font-serif font-bold text-gold-100 text-2xl flex items-center gap-3">
                                                {mode === 'create'
                                                    ? <Plus className="w-5 h-5 text-gold-500" aria-hidden="true" />
                                                    : <img src={EDIT_PEN_IMG.src} srcSet={EDIT_PEN_IMG.srcSet} alt="" className="w-7 h-auto block" />}
                                                {mode === 'create' ? 'Create Identity' : 'Edit Identity'}
                                            </h3>
                                            <button type="button" onClick={handleCancel} aria-label="Close form" className={closeBtnCls}>
                                                <X className="w-5 h-5" aria-hidden="true" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-7">
                                            <div className="flex flex-col gap-4">
                                                <label className="flex flex-col gap-1">
                                                    <span className={labelCls}>Name</span>
                                                    <input type="text" maxLength={60} className={fieldCls} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                                </label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <label className="flex flex-col gap-1 min-w-0">
                                                        <span className={labelCls}>Race</span>
                                                        <select className={fieldCls} value={formData.race} onChange={e => setFormData({ ...formData, race: e.target.value })}>
                                                            {RACES.map(r => <option key={r} value={r}>{r}</option>)}
                                                        </select>
                                                    </label>
                                                    <label className="flex flex-col gap-1 min-w-0">
                                                        <span className={labelCls}>Class</span>
                                                        <select className={fieldCls} value={formData.class} onChange={e => setFormData({ ...formData, class: e.target.value })}>
                                                            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </label>
                                                </div>
                                                <div className="flex flex-col gap-3 p-4 bg-ink-950 border border-ink-800 rounded">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={labelCls}>Portrait</span>
                                                        <span className="text-sm text-ink-300">Upload an image or paste its link, then drag it to set the focus point.</span>
                                                    </div>
                                                    <ImageUploader
                                                        initialUrl={formData.imageUrl}
                                                        initialPosition={formData.imagePosition}
                                                        folder="character_portraits"
                                                        shape="circle"
                                                        onImageChanged={handleImageChanged}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-4">
                                                <label className="flex flex-col gap-1 flex-1">
                                                    <span className={labelCls}>Description</span>
                                                    <textarea rows={7} maxLength={5000} className={`${fieldCls} flex-1 resize-y min-h-36`} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                                </label>
                                                {mode === 'create' && (
                                                    <label className="flex items-center gap-3 cursor-pointer">
                                                        <input type="checkbox" checked={createCodex} onChange={e => setCreateCodex(e.target.checked)} className="w-[1.125rem] h-[1.125rem] accent-gold-600" />
                                                        <span className="text-sm text-ink-200">Create Codex Entry?</span>
                                                    </label>
                                                )}
                                            </div>
                                        </div>

                                        {formError && <p role="alert" className={errorCls}>{formError}</p>}

                                        <div className="flex items-center justify-end gap-3">
                                            <button type="button" onClick={handleCancel} className={cancelBtnCls}>Cancel</button>
                                            <button type="submit" disabled={isSubmitting} className="rounded bg-gold-700 hover:bg-gold-600 disabled:opacity-60 text-white font-bold px-5 py-2 flex items-center gap-2 transition-colors">
                                                {isSubmitting && <Loader className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                                {mode === 'create' ? 'Summon' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {mode === 'delete' && (
                                    <div className="max-w-lg mx-auto bg-ink-900 border border-red-900 rounded-xl p-5 md:p-7 flex flex-col gap-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="font-serif font-bold text-red-400 text-2xl flex items-center gap-3">
                                                <Trash2 className="w-[22px] h-[22px]" strokeWidth={1.8} aria-hidden="true" />
                                                Delete Character
                                            </h3>
                                            <button type="button" onClick={backToRoster} aria-label="Close" className={closeBtnCls}>
                                                <X className="w-5 h-5" aria-hidden="true" />
                                            </button>
                                        </div>
                                        {!confirmDeleteStep ? (
                                            <div className="flex flex-col gap-4">
                                                <label className="flex flex-col gap-1">
                                                    <span className={labelCls}>Character</span>
                                                    <select className={fieldCls} value={deleteId} onChange={(e) => setDeleteId(e.target.value)} disabled={characters.length === 0}>
                                                        {characters.length === 0 && <option value="">No characters</option>}
                                                        {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </label>
                                                <div className="flex justify-end gap-3">
                                                    <button type="button" onClick={backToRoster} className={cancelBtnCls}>Cancel</button>
                                                    <button type="button" onClick={() => setConfirmDeleteStep(true)} disabled={!deleteChar} className="rounded bg-red-950 border border-red-900 text-red-400 hover:text-red-300 font-bold px-5 py-2 transition-colors disabled:opacity-50">Delete</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-4">
                                                <p className="text-ink-200">
                                                    <span className="font-bold text-red-400">Are you sure?</span> This action cannot be undone.{' '}
                                                    <span className="font-serif font-bold text-ink-50 text-lg">{deleteChar?.name}</span> will be removed from your roster.
                                                </p>
                                                <div className="flex justify-end gap-3">
                                                    <button type="button" onClick={() => setConfirmDeleteStep(false)} className={cancelBtnCls}>Cancel</button>
                                                    <button type="button" onClick={handleDelete} disabled={isSubmitting} className="rounded bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white font-bold px-5 py-2 flex items-center gap-2 transition-colors">
                                                        {isSubmitting && <Loader className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                                        Yes, Delete
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {formError && <p role="alert" className={errorCls}>{formError}</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
