import { useState, useEffect } from 'react';
import { 
  collection, query, addDoc, onSnapshot, doc, setDoc, 
  serverTimestamp, where 
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { 
  Map as MapIcon, ChevronLeft, Plus, MessageSquare, 
  Users, ImageIcon, Loader, Edit3, Save, X
} from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';
import MarkdownEditor from '@/components/MarkdownEditor'; 

const formatTimestamp = (firestoreTimestamp) => {
  if (!firestoreTimestamp?.toDate) return 'Just now';
  return firestoreTimestamp.toDate().toLocaleDateString();
};

export default function RegionView({ region, setView, setActiveThread }) {
  const { user, readReceipts, characters, activeCharId } = useGame();
  
  // State
  const [threads, setThreads] = useState([]);
  const [regionMetadata, setRegionMetadata] = useState(null);
  
  // Edit States
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Creating Thread
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newBanner, setNewBanner] = useState({ url: '', position: 'center' }); 
  const [createCodexEntry, setCreateCodexEntry] = useState(false);
  
  const [sessionUploads, setSessionUploads] = useState([]);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    if (!region || region.id === undefined) return;

    // 1. Metadata Query (Single Doc)
    const metaRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata', region.id.toString());
    const unsubMeta = onSnapshot(metaRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRegionMetadata(data);
        if (!isEditingName) setNameInput(data.name || region.name);
      } else {
        setRegionMetadata({ bannerUrl: '' });
        setNameInput(region.name);
      }
    });

    // 2. Threads Query
    const q = query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'),
        where('regionId', '==', region.id.toString())
    );

    const unsubThreads = onSnapshot(q, (snapshot) => {
      const t = [];
      snapshot.docs.forEach(d => {
        t.push({ id: d.id, ...d.data() });
      });
      t.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setThreads(t);
    });

    return () => { unsubMeta(); unsubThreads(); };
  }, [region]);

  const handleSaveBanner = async (url, position) => {
    if (!region) return;
    try {
      // CLEANUP: If there was an old banner, delete it
      const oldBannerUrl = regionMetadata?.bannerUrl;
      if (oldBannerUrl && oldBannerUrl !== url && oldBannerUrl.includes('firebasestorage')) {
           try { await deleteObject(ref(storage, oldBannerUrl)); } catch(e) { console.warn("Cleanup failed:", e); }
      }

      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata', region.id.toString()), { 
        bannerUrl: url,
        bannerPosition: position
      }, { merge: true });
    } catch (e) { console.error(e); }
  };

  const handleSaveName = async () => {
    if (!region || !nameInput.trim()) return;
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata', region.id.toString()), { name: nameInput }, { merge: true });
      setIsEditingName(false);
    } catch (e) { console.error(e); }
  };

  const handleCreateThread = async () => {
    if (!activeCharId) return alert("Please select a character before creating a thread.");
    if (!newTitle || newTitle.length < 3) return alert("Title must be at least 3 characters.");
    if (!newContent || newContent.length < 10) return alert("Content must be at least 10 characters.");
    if (cooldown) return;
    
    setCooldown(true);
    const char = characters.find(c => c.id === activeCharId);
    const currentRegionName = regionMetadata?.name || region.name;
    
    try {
      const threadRef = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'), {
        regionId: region.id.toString(),
        title: newTitle,
        createdBy: char.name,
        creatorId: user.uid,
        bannerUrl: newBanner.url,
        bannerPosition: newBanner.position,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        postCount: 1
      });
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), {
        threadId: threadRef.id,
        content: newContent,
        characterName: char.name,
        characterRace: char.race,
        characterClass: char.class,
        characterImageUrl: char.imageUrl || '',
        characterImagePosition: char.imagePosition || 'center',
        characterId: char.id,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', threadRef.id), { lastRead: serverTimestamp() });

      if (createCodexEntry) {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'), {
          title: `Lore: ${currentRegionName}`,
          category: 'Regions',
          content: `Tales from **${currentRegionName}**...\n\nStarted by ${char.name}.\n\n${newContent}`,
          gallery: [],
          relatedId: region.id.toString(),
          updatedAt: serverTimestamp(),
          updatedBy: char.name
        });
      }
      setSessionUploads([]); // Clear session tracking on success
      setNewTitle(''); setNewContent(''); setNewBanner({url:'', position:'center'}); setIsCreating(false);
    } catch (e) { 
        console.error("Error creating thread:", e); 
        alert("Failed to create thread.");
    } finally {
        setTimeout(() => setCooldown(false), 2000);
    }
  };

  const handleCancelCreate = async () => {
    // Cleanup orphaned uploads
    for (const url of sessionUploads) {
        try {
            const fileRef = ref(storage, url);
            await deleteObject(fileRef);
        } catch (e) {
            console.log("Cleanup: File already gone or failed", url);
        }
    }
    setSessionUploads([]);
    setNewTitle(''); setNewContent(''); setNewBanner({url:'', position:'center'});
    setIsCreating(false);
  };

  if (!region || region.id === undefined) return <div className="h-full flex items-center justify-center bg-slate-950 text-slate-500"><Loader className="w-8 h-8 animate-spin text-amber-500"/></div>;

  const bannerUrl = regionMetadata?.bannerUrl || null;
  const bannerPos = regionMetadata?.bannerPosition || 'center';
  const displayName = regionMetadata?.name || region.name;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-linear-to-b from-slate-950 to-slate-900 pb-48">
      {/* Banner Header */}
      <div className="relative w-full h-64 md:h-96 bg-slate-900 border-b border-amber-900/50 overflow-hidden shrink-0 group/banner">
         {bannerUrl ? (
            <img 
                src={bannerUrl} 
                className="w-full h-full object-cover opacity-50 transition-all duration-300" 
                style={{ objectPosition: bannerPos }}
                onError={(e) => e.target.style.display = 'none'}
            />
         ) : (
            <div className="w-full h-full bg-linear-to-b from-slate-800 to-slate-950 opacity-50" />
         )}
         <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8 bg-linear-to-t from-slate-950 via-slate-950/50 to-transparent">
            <div className="max-w-4xl mx-auto w-full flex items-end justify-between">
                <div className="flex-1">
                   {isEditingName ? (
                     <div className="flex items-center gap-2">
                       <input 
                         className="bg-black/50 border border-amber-500/50 text-3xl font-serif font-bold text-white px-2 py-1 rounded focus:outline-none w-full max-w-md"
                         value={nameInput}
                         onChange={(e) => setNameInput(e.target.value)}
                         autoFocus
                       />
                       <button onClick={handleSaveName} className="p-2 bg-amber-700 hover:bg-amber-600 rounded text-white"><Save className="w-5 h-5"/></button>
                       <button onClick={() => setIsEditingName(false)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-white"><X className="w-5 h-5"/></button>
                     </div>
                   ) : (
                     <div className="flex items-center gap-3 group/title">
                        <h1 className="text-4xl md:text-5xl font-serif font-bold text-amber-100 drop-shadow-lg">{displayName}</h1>
                        {user && (
                          <button onClick={() => setIsEditingName(true)} className="text-slate-500 hover:text-amber-500 opacity-0 group-hover/title:opacity-100 transition-opacity" title="Rename Region"><Edit3 className="w-5 h-5"/></button>
                        )}
                     </div>
                   )}
                </div>
                {user && (
                    <button onClick={() => setIsEditingBanner(!isEditingBanner)} className="p-2 bg-slate-900/80 text-slate-400 hover:text-amber-500 rounded-full border border-slate-700 hover:border-amber-500 transition-all opacity-0 group-hover/banner:opacity-100" title="Change Banner"><ImageIcon className="w-5 h-5" /></button>
                )}
            </div>
         </div>
      </div>

      {isEditingBanner && (
        <div className="bg-slate-900 border-b border-amber-900/30 p-4 animate-in slide-in-from-top-2">
           <div className="max-w-4xl mx-auto space-y-2">
              <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm text-amber-500 font-bold">Edit Region Banner</h4>
                  <button onClick={() => setIsEditingBanner(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4"/></button>
              </div>
              <ImageUploader 
                initialUrl={bannerUrl}
                initialPosition={bannerPos}
                folder="region_banners"
                shape="banner"
                onImageChanged={handleSaveBanner}
              />
           </div>
        </div>
      )}

      {/* Content Area */}
      <div className="max-w-4xl mx-auto w-full p-4 md:p-8">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setView('map')} className="text-slate-400 hover:text-white flex items-center gap-1"><ChevronLeft className="w-5 h-5" /> Map</button>
            <div className="flex-1"></div>
            <button onClick={() => setIsCreating(!isCreating)} className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded flex items-center gap-2"><Plus className="w-5 h-5" /> New Thread</button>
        </div>

        {isCreating && (
          <div className="bg-slate-900/80 p-6 rounded-lg border border-amber-900 mb-8 backdrop-blur-sm">
             <h3 className="text-amber-100 font-bold mb-4">Post a New Topic</h3>
             <input className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-100 mb-4 focus:border-amber-500 focus:outline-none" placeholder="Thread Title (Min 3 chars)..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
             
             <div className="mb-4 bg-slate-950 p-4 rounded border border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Thread Banner (Optional)</h4>
                <ImageUploader
                  folder="thread_banners"
                  shape="banner"
                  onImageChanged={(url, pos) => {
                    setNewBanner({ url, position: pos });
                    setSessionUploads(prev => [...prev, url]);
                  }}
                />
             </div>
             
             {/* Markdown Editor */}
             <div className="mb-4">
                 <MarkdownEditor 
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Describe your thread, recommend italics"
                 />
             </div>

             <div className="flex items-center gap-2 mb-4">
               <input type="checkbox" checked={createCodexEntry} onChange={(e) => setCreateCodexEntry(e.target.checked)} className="w-4 h-4" />
               <label className="text-sm text-slate-400">Add this lore to the Codex?</label>
             </div>
             <div className="flex justify-end gap-2">
               <button onClick={handleCancelCreate} className="text-slate-400 hover:text-white px-4 py-2">Cancel</button>
               <button onClick={handleCreateThread} disabled={cooldown} className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-2 rounded">{cooldown ? 'Wait...' : 'Post Thread'}</button>
             </div>
          </div>
        )}

        <div className="space-y-3">
            {threads.length === 0 ? <div className="text-center py-12 text-slate-500 italic bg-slate-900/30 rounded-lg border border-slate-800 border-dashed">The wind howls... there are no stories here yet.</div> : 
               threads.map(thread => {
                 const lastRead = readReceipts[thread.id] || 0;
                 const isUnread = (thread.updatedAt?.toMillis() || 0) > lastRead;
                 return (
                   <div key={thread.id} onClick={() => { setActiveThread(thread); setView('thread'); }} className="bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-amber-700 p-4 rounded-lg cursor-pointer transition-all group relative overflow-hidden">
                     {isUnread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_10px_cyan]" />}
                     <div className="flex justify-between items-start pl-2">
                       <div>
                         <h3 className={`text-lg font-bold transition-colors flex items-center gap-2 ${isUnread ? 'text-cyan-100' : 'text-slate-200 group-hover:text-amber-400'}`}>
                           {thread.title}
                           {isUnread && <span className="text-[10px] bg-cyan-900/50 text-cyan-400 border border-cyan-500/50 px-1.5 rounded uppercase tracking-wider font-bold">New</span>}
                         </h3>
                         <div className="flex items-center gap-2 text-xs text-slate-500 mt-1"><span className="flex items-center gap-1"><Users className="w-3 h-3" /> {thread.createdBy}</span><span>•</span><span>{formatTimestamp(thread.updatedAt)}</span></div>
                       </div>
                       <div className={`transition-colors ${isUnread ? 'text-cyan-400' : 'text-slate-600 group-hover:text-amber-600'}`}><MessageSquare className="w-5 h-5" /></div>
                     </div>
                   </div>
                 );
               })
            }
        </div>
      </div>
    </div>
  );
}