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
  Users, ImageIcon, Loader, Edit3, Save, X, Circle
} from 'lucide-react';

const formatTimestamp = (firestoreTimestamp) => {
  if (!firestoreTimestamp?.toDate) return 'Just now';
  return firestoreTimestamp.toDate().toLocaleDateString();
};

export default function RegionView({ region, setView, setActiveThread }) {
  const { user, userRole, characters, activeCharId } = useGame();
  const [threads, setThreads] = useState([]);
  const [regionMetadata, setRegionMetadata] = useState(null);
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [bannerInput, setBannerInput] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newBanner, setNewBanner] = useState('');
  const [createCodexEntry, setCreateCodexEntry] = useState(false);
  const [userReadHistory, setUserReadHistory] = useState({}); // Local read history

  // 1. Data Fetching
  useEffect(() => {
    if (!region || region.id === undefined) return;

    // Metadata
    const metaRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'region_metadata', region.id.toString());
    const unsubMeta = onSnapshot(metaRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRegionMetadata(data);
        if (!isEditingBanner) setBannerInput(data.bannerUrl || '');
        if (!isEditingName) setNameInput(data.name || region.name);
      } else {
        setRegionMetadata({ bannerUrl: '' });
        setBannerInput('');
        setNameInput(region.name);
      }
    });

    // Threads
    const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'));
    const unsubThreads = onSnapshot(q, (snapshot) => {
      const t = [];
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.regionId === region.id.toString()) {
            t.push({ id: d.id, ...data });
        }
      });
      t.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setThreads(t);
    });

    // Read History (For blue dots)
    const unsubRead = onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts'), (snap) => {
        const history = {};
        snap.docs.forEach(doc => history[doc.id] = doc.data().lastRead?.toMillis() || 0);
        setUserReadHistory(history);
    });

    return () => { unsubMeta(); unsubThreads(); unsubRead(); };
  }, [region, user]);

  // 2. Handlers
  const handleSaveBanner = async () => { /* ... existing ... */ };
  const handleSaveName = async () => { /* ... existing ... */ };

  // FIX: Better Error Message
  const handleCreateThread = async () => {
    if (!activeCharId) return alert("Please select a character from the roster before creating a thread.");
    if (!newTitle || !newContent) return alert("Please fill out the title and content fields.");
    
    const char = characters.find(c => c.id === activeCharId);
    const currentRegionName = regionMetadata?.name || region.name;
    
    try {
      const threadRef = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'), {
        regionId: region.id.toString(),
        title: newTitle,
        createdBy: char.name,
        creatorId: user.uid,
        bannerUrl: newBanner,
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
        characterId: char.id,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      if (createCodexEntry) {
         // ... existing codex logic ...
      }

      setNewTitle(''); setNewContent(''); setNewBanner(''); setIsCreating(false);
    } catch (e) { console.error("Error creating thread:", e); }
  };

  const openThread = (thread) => {
      setActiveThread(thread);
      setView('thread');
  };

  if (!region || region.id === undefined) return <div className="p-10 flex justify-center"><Loader className="animate-spin"/></div>;

  const bannerUrl = regionMetadata?.bannerUrl || null;
  const displayName = regionMetadata?.name || region.name;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-linear-to-b from-slate-950 to-slate-900 pb-48">
      {/* ... (Banner Section same as before) ... */}

      {/* Content Area */}
      <div className="max-w-4xl mx-auto w-full p-4 md:p-8">
        {/* ... (Header Buttons) ... */}

        {/* Thread List with Unread Dots */}
        <div className="space-y-3">
            {threads.length === 0 ? (
               <div className="text-center py-12 text-slate-500 italic bg-slate-900/30 rounded-lg border border-slate-800 border-dashed">The wind howls... there are no stories here yet.</div>
            ) : (
               threads.map(thread => {
                 const lastActivity = thread.updatedAt?.toMillis() || 0;
                 const lastRead = userReadHistory[thread.id] || 0;
                 const isUnread = lastActivity > lastRead;

                 return (
                 <div 
                   key={thread.id} 
                   onClick={() => openThread(thread)} 
                   className="bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-amber-700 p-4 rounded-lg cursor-pointer transition-all group relative overflow-hidden"
                 >
                   {isUnread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 shadow-[0_0_10px_cyan]"></div>}
                   <div className="flex justify-between items-start pl-2">
                     <div>
                       <h3 className={`text-lg font-bold transition-colors ${isUnread ? 'text-white' : 'text-slate-300 group-hover:text-amber-400'}`}>
                           {thread.title}
                       </h3>
                       <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                         <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {thread.createdBy}</span>
                         <span>•</span>
                         <span>{formatTimestamp(thread.updatedAt)}</span>
                       </div>
                     </div>
                     <div className="text-slate-600 group-hover:text-amber-600 transition-colors">
                       <MessageSquare className="w-5 h-5" />
                     </div>
                   </div>
                 </div>
                 );
               })
            )}
        </div>
      </div>
    </div>
  );
}