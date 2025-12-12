import { useState, useEffect } from 'react';
import { 
  collection, query, addDoc, onSnapshot, doc, getDoc, 
  serverTimestamp, updateDoc, deleteDoc, getDocs, writeBatch, where 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { 
  Map as MapIcon, ChevronLeft, Feather, Ghost, 
  Edit3, Loader, Trash2, Shield, Copy, Check, User
} from 'lucide-react';

const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return 'Just now';
    return timestamp.toDate().toLocaleString();
};

export default function ThreadView({ thread, setView, region, onOpenCodex }) {
  const { user, userRole, characters, activeCharId } = useGame();
  const [posts, setPosts] = useState([]);
  const [liveThread, setLiveThread] = useState(thread);
  const [replyContent, setReplyContent] = useState('');
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [bannerInput, setBannerInput] = useState('');
  const [copiedUserId, setCopiedUserId] = useState(null);

  // Permissions
  const isAdminOrMod = userRole === 'admin' || userRole === 'moderator';
  const isOwner = user && liveThread && user.uid === liveThread.creatorId;
  const canManageThread = isAdminOrMod || isOwner;

  useEffect(() => {
    if (!thread) return;
    
    // Live update thread
    const unsubThread = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), (doc) => {
        if (doc.exists()) {
            setLiveThread({ id: doc.id, ...doc.data() });
            if (!isEditingBanner) setBannerInput(doc.data().bannerUrl || '');
        } else {
            // Thread was deleted remotely
            setView('region');
        }
    });

    // Live update posts
    const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'));
    const unsubPosts = onSnapshot(q, (snapshot) => {
      const p = [];
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.threadId === thread.id) p.push({ id: d.id, ...data });
      });
      p.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setPosts(p);
    });

    return () => { unsubThread(); unsubPosts(); };
  }, [thread]);

  const handleReply = async () => {
    if (!activeCharId || !replyContent.trim()) return;
    const char = characters.find(c => c.id === activeCharId);
    try {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), {
            threadId: thread.id,
            content: replyContent,
            characterName: char.name,
            characterRace: char.race,
            characterClass: char.class,
            characterImageUrl: char.imageUrl || '',
            characterId: char.id,
            userId: user.uid,
            createdAt: serverTimestamp()
        });
        
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), {
            updatedAt: serverTimestamp(),
            postCount: (liveThread.postCount || 0) + 1
        });
        
        setReplyContent('');
    } catch (e) { console.error(e); }
  };

  const handleSaveBanner = async () => {
      try {
          await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), { bannerUrl: bannerInput });
          setIsEditingBanner(false);
      } catch(e) { console.error(e); }
  };

  const handleDeletePost = async (postId) => {
      if (!window.confirm("Delete this post?")) return;
      try {
          await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'posts', postId));
      } catch (e) { console.error(e); }
  };

  const handleDeleteThread = async () => {
      if (!window.confirm("Delete this ENTIRE thread and all its posts? This cannot be undone.")) return;
      
      try {
          // 1. Delete Thread Document
          await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id));
          
          // 2. Delete All Posts in Thread (Batching)
          const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), where("threadId", "==", thread.id));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          snapshot.docs.forEach((doc) => {
              batch.delete(doc.ref);
          });
          await batch.commit();

          // 3. Navigate back
          setView('region');
      } catch (e) { console.error("Error deleting thread:", e); }
  };

  const handleCopyUserId = (id) => {
      navigator.clipboard.writeText(id);
      setCopiedUserId(id);
      setTimeout(() => setCopiedUserId(null), 2000);
  };

  if (!liveThread) return <div className="h-full flex items-center justify-center text-slate-500"><Loader className="animate-spin mr-2"/> Loading...</div>;

  const threadBanner = liveThread.bannerUrl || null;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-950 pb-48">
       {/* Thread Banner */}
       {threadBanner && (
         <div className="relative w-full h-48 bg-slate-900 border-b border-amber-900/50 overflow-hidden shrink-0 group">
             <img src={threadBanner} className="w-full h-full object-cover opacity-60" onError={(e) => e.target.style.display = 'none'}/>
             <div className="absolute inset-0 bg-linear-to-t from-slate-950 to-transparent" />
             
             {/* Edit Banner Button */}
             {canManageThread && (
                 <button 
                    onClick={() => setIsEditingBanner(!isEditingBanner)}
                    className="absolute top-4 right-4 p-2 bg-black/60 text-white hover:text-amber-500 rounded-full border border-white/20 transition-all opacity-0 group-hover:opacity-100"
                    title="Edit Banner"
                 >
                    <Edit3 className="w-4 h-4" />
                 </button>
             )}
         </div>
       )}

        {isEditingBanner && (
            <div className="bg-slate-900 border-b border-amber-900/30 p-4 animate-in slide-in-from-top-2 relative z-30">
                <div className="max-w-4xl mx-auto flex gap-4 items-center">
                    <span className="text-sm text-amber-500 font-bold shrink-0">Thread Banner:</span>
                    <input 
                        className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-amber-500 focus:outline-none"
                        value={bannerInput}
                        onChange={(e) => setBannerInput(e.target.value)}
                    />
                    <button onClick={handleSaveBanner} className="px-3 py-1 bg-amber-700 text-white rounded text-xs">Save</button>
                </div>
            </div>
        )}

       {/* Header */}
       <div className={`flex items-center gap-4 px-4 md:px-8 py-6 ${threadBanner ? 'relative -mt-20 z-10' : 'sticky top-0 bg-slate-950/95 backdrop-blur-md z-20 border-b border-slate-800'}`}>
        <button onClick={() => setView('region')} className={`flex items-center gap-1 ${threadBanner ? "bg-black/50 px-3 py-1 rounded hover:bg-black/70 text-white border-none" : "text-slate-400 hover:text-white"}`}>
          <ChevronLeft className="w-5 h-5" /> Back
        </button>
        <div className="flex-1">
            <div className="flex items-center gap-3">
                <h1 className={`text-2xl md:text-3xl font-serif font-bold ${threadBanner ? 'text-white drop-shadow-lg' : 'text-amber-100'}`}>
                    {liveThread.title}
                </h1>
                
                {/* Admin Controls for Thread */}
                {canManageThread && (
                    <div className="flex items-center gap-1 bg-slate-900/80 rounded-lg border border-slate-700 p-1">
                        {!threadBanner && (
                           <button onClick={() => setIsEditingBanner(!isEditingBanner)} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors" title="Edit Banner"><Edit3 className="w-4 h-4"/></button>
                        )}
                        <button onClick={handleDeleteThread} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Delete Thread"><Trash2 className="w-4 h-4"/></button>
                    </div>
                )}
            </div>
          <div className={`flex items-center gap-2 text-sm ${threadBanner ? 'text-amber-200/80' : 'text-amber-600/60'}`}>
            <MapIcon className="w-3 h-3" />
            {region ? region.name : 'Unknown Region'}
          </div>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="flex gap-4 md:gap-6 group relative">
            
            {/* Delete Post Button (Admins/Mods Only) */}
            {isAdminOrMod && (
                <button 
                    onClick={() => handleDeletePost(post.id)}
                    className="absolute top-2 right-2 text-red-900/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Delete Post (Admin)"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}

            {/* Avatar */}
            <div className="flex flex-col items-center gap-2 w-24 shrink-0">
               <div 
                 onClick={() => onOpenCodex && onOpenCodex(post.characterId)}
                 className="w-16 h-16 md:w-20 md:h-20 bg-slate-800 rounded-lg border-2 border-slate-700 overflow-hidden shadow-lg relative bg-cover bg-center cursor-pointer hover:border-amber-500 transition-colors"
               >
                 <img src={post.characterImageUrl || ''} className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'}/>
                 <div className="absolute inset-0 flex items-center justify-center text-3xl bg-slate-700 text-slate-300 font-bold -z-10">
                   {post.characterName ? post.characterName.substring(0,1) : '?'}
                 </div>
               </div>
               
               <div className="text-center w-full">
                 <div onClick={() => onOpenCodex && onOpenCodex(post.characterId)} className="text-xs font-bold text-amber-500 truncate w-full cursor-pointer hover:underline">
                    {post.characterName}
                 </div>
                 <div className="text-[10px] text-slate-500 uppercase tracking-wider">{post.characterRace} {post.characterClass}</div>
                 
                 {/* ADMIN VISION: Copy User ID Button */}
                 {isAdminOrMod && (
                     <div className="mt-1 flex justify-center">
                         <button 
                            onClick={() => handleCopyUserId(post.userId)}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-500 border border-slate-700 rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors"
                            title="Copy User ID for Ban"
                         >
                            {copiedUserId === post.userId ? <Check className="w-3 h-3 text-emerald-500"/> : <User className="w-3 h-3"/>}
                            ID
                         </button>
                     </div>
                 )}
               </div>
            </div>

            {/* Post Content */}
            <div className="flex-1 bg-slate-900/50 border border-slate-800 p-4 md:p-6 rounded-xl rounded-tl-none relative shadow-sm">
              <div className="prose prose-invert prose-p:text-slate-300 prose-headings:text-amber-100 max-w-none">
                <p className="whitespace-pre-wrap leading-relaxed font-serif text-lg">{post.content}</p>
              </div>
              <div className="absolute top-2 right-4 text-[10px] text-slate-700">
                 {formatTimestamp(post.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Reply Box */}
      <div className="fixed bottom-[60px] md:bottom-[70px] left-0 right-0 p-4 bg-slate-950/90 border-t border-amber-900/30 z-30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex gap-4 items-start">
             <div className="hidden md:block w-12 h-12 bg-slate-800 rounded border border-slate-700 shrink-0 overflow-hidden relative">
                {activeCharId && characters.find(c => c.id === activeCharId) ? (
                  <>
                    <img src={characters.find(c => c.id === activeCharId).imageUrl || ''} className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'}/>
                    <div className="absolute inset-0 flex items-center justify-center font-bold text-amber-500 bg-slate-800 -z-10">
                        {characters.find(c => c.id === activeCharId).name.substring(0,1)}
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600"><Ghost className="w-6 h-6"/></div>
                )}
             </div>
             
             <div className="flex-1 relative">
                <textarea
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 pr-24 text-slate-100 focus:border-amber-500 focus:outline-none min-h-[50px] resize-none shadow-inner"
                  placeholder={activeCharId ? `Reply as ${characters.find(c => c.id === activeCharId)?.name}...` : "Create a character to reply..."}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                />
                <div className="absolute bottom-3 right-3">
                  <button onClick={handleReply} disabled={!activeCharId || !replyContent.trim()} className="flex items-center gap-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-1 rounded text-sm">
                    <Feather className="w-4 h-4" /> Post
                  </button>
                </div>
             </div>
        </div>
      </div>
    </div>
    );
}