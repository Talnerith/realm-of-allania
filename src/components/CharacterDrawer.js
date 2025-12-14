import { useState } from 'react';
import { 
  collection, addDoc, doc, updateDoc, deleteDoc, 
  serverTimestamp, writeBatch, getDocs, query, where 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID, RACES, CLASSES } from '@/lib/constants';
import { 
  Shield, ChevronDown, ChevronUp, Edit3, Plus, 
  X, Trash2, AlertCircle, AlertTriangle, Loader
} from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';

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

  const resetForm = () => {
    setFormData({ name: '', race: RACES[0], class: CLASSES[0], description: '', imageUrl: '', imagePosition: 'center' });
    setCreateCodex(true);
    setFormError('');
    setIsSubmitting(false);
  };

  const openCreator = () => { resetForm(); setMode('create'); };
  
  const openEditor = (e, char) => {
    e.stopPropagation();
    setEditingId(char.id);
    setFormData({ 
        name: char.name, race: char.race, class: char.class, 
        description: char.description || '', 
        imageUrl: char.imageUrl || '',
        imagePosition: char.imagePosition || 'center'
    });
    setMode('edit');
  };

  const openDelete = (e) => {
      e.stopPropagation();
      setDeleteId(characters.length > 0 ? characters[0].id : '');
      setConfirmDeleteStep(false);
      setMode('delete');
  };

  const handleCreate = async () => {
    if (!formData.name) return setFormError('Name is required');
    if (!user) return setFormError('You must be logged in.');

    setIsSubmitting(true);
    setFormError('');

    try {
      const charRef = await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'characters'), {
        ...formData, createdAt: serverTimestamp()
      });

      if (createCodex) {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'), {
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
      await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'characters', editingId), formData);
      setMode('view');
      setEditingId(null);
    } catch (e) { console.error(e); setFormError(`Update failed: ${e.message}`); } 
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const char = characters.find(c => c.id === deleteId);
    if (!char) return;
    setIsSubmitting(true);
    try {
        await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'characters', deleteId));
        const batch = writeBatch(db);
        const codexQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'), where('relatedId', '==', deleteId));
        const codexSnap = await getDocs(codexQ);
        codexSnap.forEach(d => batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages', d.id), { title: `[Archived] ${char.name}`, category: 'Lore' }));
        const postsQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), where('characterId', '==', deleteId));
        const postsSnap = await getDocs(postsQ);
        postsSnap.forEach(d => batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'posts', d.id), { characterName: `${char.name} [Deleted]`, characterImageUrl: '' }));
        await batch.commit();
        setMode('view');
        if (activeCharId === deleteId) setActiveCharId(null);
    } catch (e) { console.error("Cleanup error:", e); setFormError(`Delete failed: ${e.message}`); } 
    finally { setIsSubmitting(false); }
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-amber-700 shadow-[0_-5px_30px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out flex flex-col ${isOpen ? 'h-[80vh] md:h-[500px]' : 'h-14 md:h-16'}`}>
      <div onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between px-6 h-14 md:h-16 shrink-0 cursor-pointer bg-slate-900 hover:bg-slate-800 transition-colors">
        <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-500" />
            <span className="font-serif font-bold text-amber-100">Character Roster</span>
            <span className="text-xs text-slate-500 hidden md:inline">|</span>
            {characters.find(c => c.id === activeCharId) ? (
                <span className="text-sm text-amber-500 font-bold flex items-center gap-2">Playing as: {characters.find(c => c.id === activeCharId).name}</span>
            ) : (
                <span className="text-sm text-slate-500 italic">No character selected</span>
            )}
        </div>
        <div className="flex items-center gap-4">
            <button onClick={(e) => openDelete(e)} className="text-slate-500 hover:text-red-500 transition-colors" title="Delete Character"><Trash2 className="w-5 h-5" /></button>
            <div className="text-slate-500 hover:text-amber-500">{isOpen ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-950/50">
         <div className="max-w-5xl mx-auto">
            {mode === 'view' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {characters.map(char => (
                        <div key={char.id} onClick={() => setActiveCharId(char.id)} className={`relative p-3 rounded-xl border flex items-center gap-4 cursor-pointer transition-all ${activeCharId === char.id ? 'bg-amber-900/30 border-amber-500 shadow-lg shadow-amber-900/20' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-500'}`}>
                            <div className="w-16 h-16 shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
                                <img 
                                    src={char.imageUrl || ''} 
                                    className="w-full h-full object-cover" 
                                    style={{ objectPosition: char.imagePosition || 'center' }}
                                    onError={(e) => e.target.style.display='none'} 
                                />
                                {!char.imageUrl && <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-xl">{char.name[0]}</div>}
                            </div>
                            <div className="overflow-hidden flex-1">
                                <h4 className={`font-bold truncate ${activeCharId === char.id ? 'text-amber-100' : 'text-slate-300'}`}>{char.name}</h4>
                                <p className="text-xs text-slate-500">{char.race} {char.class}</p>
                                {activeCharId === char.id && <span className="text-[10px] text-amber-500 uppercase font-bold tracking-wider mt-1 block">Active</span>}
                            </div>
                            <button onClick={(e) => openEditor(e, char)} className="p-2 text-slate-500 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4"/></button>
                        </div>
                    ))}
                    <button onClick={openCreator} className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-500 hover:text-amber-500 hover:border-amber-500 hover:bg-slate-900/50 transition-all gap-2 h-24">
                        <Plus className="w-6 h-6" /><span className="text-xs font-bold uppercase tracking-wide">New Character</span>
                    </button>
                </div>
            )}
            {(mode === 'create' || mode === 'edit') && (
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 relative">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-amber-100 font-bold flex items-center gap-2">{mode === 'create' ? <><Plus className="w-4 h-4"/> Create Identity</> : <><Edit3 className="w-4 h-4"/> Edit Identity</>}</h3>
                        <button onClick={() => setMode('view')}><X className="w-5 h-5 text-slate-500"/></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div><label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Name</label><input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:border-amber-500 focus:outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Race</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:border-amber-500 focus:outline-none" value={formData.race} onChange={e => setFormData({...formData, race: e.target.value})}>{RACES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                                <div><label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Class</label><select className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:border-amber-500 focus:outline-none" value={formData.class} onChange={e => setFormData({...formData, class: e.target.value})}>{CLASSES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            </div>
                            
                            {/* NEW: Image Uploader */}
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
                            <textarea className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:border-amber-500 focus:outline-none text-sm resize-none mb-4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                            {mode === 'create' && (<div className="flex items-center gap-2 mb-4"><input type="checkbox" checked={createCodex} onChange={e => setCreateCodex(e.target.checked)} className="w-4 h-4" /><label className="text-sm text-slate-400">Create Codex Entry?</label></div>)}
                            <div className="flex justify-end gap-3"><button onClick={() => setMode('view')} className="text-slate-400 hover:text-white px-3">Cancel</button><button onClick={mode === 'create' ? handleCreate : handleUpdate} disabled={isSubmitting} className="bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 text-white px-4 py-2 rounded flex items-center gap-2">{isSubmitting && <Loader className="w-4 h-4 animate-spin"/>} {mode === 'create' ? 'Summon' : 'Save Changes'}</button></div>
                        </div>
                    </div>
                    {formError && <p className="text-red-500 text-xs mt-2 absolute bottom-6 left-6 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {formError}</p>}
                </div>
            )}
            {mode === 'delete' && (
                <div className="bg-slate-900 border border-red-900/50 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-6"><h3 className="text-red-400 font-bold flex items-center gap-2"><Trash2 className="w-5 h-5"/> Delete Character</h3><button onClick={() => setMode('view')}><X className="w-5 h-5 text-slate-500"/></button></div>
                    <div className="bg-red-950/30 border border-red-900 rounded p-4 flex flex-col items-center text-center">
                       <AlertTriangle className="w-12 h-12 text-red-500 mb-2" />
                       {!confirmDeleteStep ? (
                           <>
                               <p className="text-slate-300 text-sm mb-4">Select a character to permanently delete.</p>
                               <div className="flex gap-3 w-full max-w-md"><select className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-slate-100 focus:border-red-500 focus:outline-none" value={deleteId} onChange={(e) => setDeleteId(e.target.value)}><option value="">-- Select --</option>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button onClick={() => setConfirmDeleteStep(true)} disabled={!deleteId} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded">Delete</button></div>
                            </>
                       ) : (
                           <><h4 className="text-red-200 font-bold text-lg mb-1">Are you sure?</h4><p className="text-slate-400 text-sm mb-4">This action cannot be undone.</p><div className="flex gap-3"><button onClick={() => setConfirmDeleteStep(false)} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button><button onClick={handleDelete} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2">{isSubmitting && <Loader className="w-4 h-4 animate-spin"/>} Yes, Delete</button></div></>
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