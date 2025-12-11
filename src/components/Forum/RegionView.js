import { useState, useEffect } from 'react';
import { 
  collection, query, addDoc, onSnapshot, doc, setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { 
  Map as MapIcon, ChevronLeft, Plus, MessageSquare, 
  Users, ImageIcon, Loader 
} from 'lucide-react';

const formatTimestamp = (firestoreTimestamp) => {
  if (!firestoreTimestamp?.toDate) return 'Just now';
  return firestoreTimestamp.toDate().toLocaleDateString();
};

export default function RegionView({ region, setView, setActiveThread }) {
  const { user, characters, activeCharId } = useGame();
  
  // State
  const [threads, setThreads] = useState([]);
  const [regionMetadata, setRegionMetadata] = useState(null);
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [bannerInput, setBannerInput] = useState('');
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newBanner, setNewBanner] = useState('');
  const [createCodexEntry, setCreateCodexEntry] = useState(false);

  // Data Fetching
  useEffect(() => {
    if (!region) return;

    // Banner
    const metaRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata', region.id.toString());
    const unsubMeta = onSnapshot(metaRef, (docSnap) => {
      setRegionMetadata(docSnap.exists() ? docSnap.data() : { bannerUrl: '' });
      if (docSnap.exists()) setBannerInput(docSnap.data().bannerUrl || '');
    });

    // Threads
    const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'));
    const unsubThreads = onSnapshot(q, (snapshot) => {
      const t = [];
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.regionId === region.id.toString()) t.push({ id: d.id, ...data });
      });
      // Client-side sort to avoid index errors
      t.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setThreads(t);
    });

    return () => { unsubMeta(); unsubThreads(); };
  }, [region]);

  const handleSaveBanner = async () => {
    if (!region) return;
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata', region.id.toString()), { bannerUrl: bannerInput }, { merge: true });
      setIsEditingBanner(false);
    } catch (e) { console.error(e); }
  };

  const handleCreateThread = async () => {
    if (!activeCharId || !newTitle || !newContent) return alert("Please fill all fields.");
    const char = characters.find(c => c.id === activeCharId);
    
    try {
      const threadRef = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'), {
        regionId: region.id.toString(), title: newTitle, createdBy: char.name, creatorId: user.uid, bannerUrl: newBanner, updatedAt: serverTimestamp(), createdAt: serverTimestamp(), postCount: 1
      });
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), {
        threadId: threadRef.id, content: newContent, characterName: char.name, characterRace: char.race, characterClass: char.class, characterImageUrl: char.imageUrl || '', characterId: char.id, userId: user.uid, createdAt: serverTimestamp()
      });
      if (createCodexEntry) {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'), {
          title: `Lore: ${region.name}`, category: 'Regions', content: `Tales from **${region.name}**...\n\nStarted by ${char.name}.\n\n${newContent}`, gallery: [], relatedId: region.id.toString(), updatedAt: serverTimestamp(), updatedBy: char.name
        });
      }
      setNewTitle(''); setNewContent(''); setNewBanner(''); setIsCreating(false);
    } catch (e) { console.error("Error creating thread:", e); }
  };

  if (!region) return <div className="p-10 text-center"><Loader className="animate-spin m-auto"/></div>;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-linear-to-b from-slate-950 to-slate-900 pb-48">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-64 bg-slate-900 border-b border-amber-900/50 overflow-hidden shrink-0">
         {regionMetadata?.bannerUrl ? (
            <img src={regionMetadata.bannerUrl} className="w-full h-full object-cover opacity-50" onError={(e) => e.target.style.display = 'none'}/>
         ) : (
            <div className="w-full h-full bg-linear-to-b from-slate-800 to-slate-950 opacity-50" />
         )}
         <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8 bg-linear-to-t from-slate-950 via-slate-950/50 to-transparent">
            <div className="max-w-4xl mx-auto w-full flex items-end justify-between">
                <div>
                   <div className="flex items-center gap-2 text-amber-500 text-sm font-bold uppercase tracking-widest mb-1"><MapIcon className="w-4 h-4"/> Region {region.id}</div>
                   <h1 className="text-4xl md:text-5xl font-serif font-bold text-amber-100 drop-shadow-lg">{region.name}</h1>
                </div>
                <button onClick={() => setIsEditingBanner(!isEditingBanner)} className="p-2 bg-slate-900/80 text-slate-400 hover:text-amber-500 rounded-full border border-slate-700 hover:border-amber-500 transition-all"><ImageIcon className="w-5 h-5" /></button>
            </div>
         </div>
      </div>

      {isEditingBanner && (
        <div className="bg-slate-900 border-b border-amber-900/30 p-4 animate-in slide-in-from-top-2">
           <div className="max-w-4xl mx-auto flex gap-4 items-center">
              <span className="text-sm text-amber-500 font-bold shrink-0">Banner URL:</span>
              <input className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-amber-500 focus:outline-none" placeholder="https://..." value={bannerInput} onChange={(e) => setBannerInput(e.target.value)}/>
              <button onClick={handleSaveBanner} className="px-3 py-1 bg-amber-700 text-white rounded hover:bg-amber-600 text-xs">Save</button>
           </div>
        </div>
      )}

      {/* Threads List */}
      <div className="max-w-4xl mx-auto w-full p-4 md:p-8">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setView('map')} className="text-slate-400 hover:text-white flex items-center gap-1"><ChevronLeft className="w-5 h-5" /> Map</button>
            <div className="flex-1"></div>
            <button onClick={() => setIsCreating(!isCreating)} className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded flex items-center gap-2"><Plus className="w-5 h-5" /> New Thread</button>
        </div>

        {isCreating && (
          <div className="bg-slate-900/80 p-6 rounded-lg border border-amber-900 mb-8 backdrop-blur-sm">
             <h3 className="text-amber-100 font-bold mb-4">Post a New Topic</h3>
             <input className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-100 mb-3 focus:border-amber-500 focus:outline-none" placeholder="Thread Title..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)}/>
             <div className="flex gap-2 mb-3 items-center">
                <ImageIcon className="w-5 h-5 text-slate-500" />
                <input className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-amber-500 focus:outline-none" placeholder="Optional: Thread Banner URL..." value={newBanner} onChange={(e) => setNewBanner(e.target.value)}/>
             </div>
             <textarea className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-100 mb-3 h-32 focus:border-amber-500 focus:outline-none" placeholder="What does your character do?" value={newContent} onChange={(e) => setNewContent(e.target.value)}/>
             <div className="flex items-center gap-2 mb-4"><input type="checkbox" checked={createCodexEntry} onChange={(e) => setCreateCodexEntry(e.target.checked)} className="w-4 h-4"/><label className="text-sm text-slate-400">Add this lore to the Codex?</label></div>
             <div className="flex justify-end gap-2"><button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white px-4 py-2">Cancel</button><button onClick={handleCreateThread} className="bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded">Post Thread</button></div>
          </div>
        )}

        <div className="space-y-3">
            {threads.length === 0 ? (
               <div className="text-center py-12 text-slate-500 italic bg-slate-900/30 rounded-lg border border-slate-800 border-dashed">The wind howls... there are no stories here yet.</div>
            ) : (
               threads.map(thread => (
                 <div key={thread.id} onClick={() => { setActiveThread(thread); setView('thread'); }} className="bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-amber-700 p-4 rounded-lg cursor-pointer transition-all group">
                   <div className="flex justify-between items-start">
                     <div><h3 className="text-lg font-bold text-slate-200 group-hover:text-amber-400 transition-colors">{thread.title}</h3><div className="flex items-center gap-2 text-xs text-slate-500 mt-1"><span className="flex items-center gap-1"><Users className="w-3 h-3" /> {thread.createdBy}</span><span>•</span><span>{formatTimestamp(thread.updatedAt)}</span></div></div>
                     <div className="text-slate-600 group-hover:text-amber-600 transition-colors"><MessageSquare className="w-5 h-5" /></div>
                   </div>
                 </div>
               ))
            )}
        </div>
      </div>
    </div>
  );
}