import { useState, useEffect } from 'react';
import { 
  collection, query, addDoc, onSnapshot, doc, setDoc,
  serverTimestamp, updateDoc, deleteDoc, getDocs, writeBatch, where 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { 
  Map as MapIcon, ChevronLeft, Ghost, 
  Edit3, Loader, Trash2, Shield, Check, User, X, Gavel, ShieldAlert
} from 'lucide-react';
import RichText from '@/components/RichText';
import ImageUploader from '@/components/ImageUploader';
import MarkdownEditor from '@/components/MarkdownEditor'; 

const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return 'Just now';
    return timestamp.toDate().toLocaleString();
};

export default function ThreadView({ thread, setView, region, onOpenCodex }) {
  const { user, userRole, characters, activeCharId } = useGame();
  const [posts, setPosts] = useState([]);
  const [liveThread, setLiveThread] = useState(thread);
  const [replyContent, setReplyContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Banner Edit State
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  
  // Post Edit State
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostContent, setEditPostContent] = useState('');
  
  // Admin Helper
  const [copiedUserId, setCopiedUserId] = useState(null);
  const [managingUser, setManagingUser] = useState(null); // { id, name }

  const isAdmin = userRole === 'admin';
  const isAdminOrMod = userRole === 'admin' || userRole === 'moderator';
  const isThreadOwner = user && liveThread && user.uid === liveThread.creatorId;
  const canEditBanner = isAdminOrMod || isThreadOwner;
  const canDeleteThread = isAdminOrMod; 

  // 1. MARK AS READ ON ENTRY
  useEffect(() => {
      if (user && thread) {
          setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', thread.id), {
              lastRead: serverTimestamp()
          }, { merge: true });
      }
  }, [user, thread]);

  // 2. Fetch Data
  useEffect(() => {
    if (!thread) return;

    // A. Listen to the Thread Document
    const unsubThread = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), (doc) => {
        if (doc.exists()) { setLiveThread({ id: doc.id, ...doc.data() }); } 
        else { setView('region'); }
    });

    // B. Listen to Posts (OPTIMIZED)
    const q = query(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'),
        where('threadId', '==', thread.id)
    );

    const unsubPosts = onSnapshot(q, (snapshot) => {
      const p = [];
      snapshot.docs.forEach(d => { p.push({ id: d.id, ...d.data() }); });
      p.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setPosts(p);
    });

    return () => { unsubThread(); unsubPosts(); };
  }, [thread]);

  const handleReply = async () => {
    if (!activeCharId) return alert("Please select a character from the roster before posting.");
    if (!replyContent.trim()) return;
    
    setIsSending(true);
    const char = characters.find(c => c.id === activeCharId);
    
    try {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), {
            threadId: thread.id, content: replyContent, characterName: char.name, characterRace: char.race,
            characterClass: char.class, characterImageUrl: char.imageUrl || '', characterImagePosition: char.imagePosition || 'center',
            characterId: char.id, userId: user.uid, createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), { updatedAt: serverTimestamp(), postCount: (liveThread.postCount || 0) + 1 });
        await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', thread.id), { lastRead: serverTimestamp() }, { merge: true });
        setReplyContent('');
    } catch (e) { 
        console.error(e); 
        alert("Failed to post reply.");
    } finally {
        setIsSending(false);
    }
  };

  const handleEditPostStart = (post) => {
      if (post.characterId !== activeCharId) { alert(`You must be playing as ${post.characterName} to edit this post content.`); return; }
      setEditingPostId(post.id); setEditPostContent(post.content);
  };

  const handleEditPostSave = async () => {
      if (!editingPostId || !editPostContent.trim()) return;
      try {
          await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'posts', editingPostId), { content: editPostContent, isEdited: true, editedAt: serverTimestamp() });
          setEditingPostId(null); setEditPostContent('');
      } catch(e) { console.error(e); }
  };

  const handleBannerUpdate = async (url, position) => {
      try { await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id), { bannerUrl: url, bannerPosition: position }); } catch(e) { console.error(e); }
  };

  const handleDeletePost = async (postId) => { if (!window.confirm("Delete this post? This action is reserved for Moderators.")) return; try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'posts', postId)); } catch (e) { console.error(e); } };
  const handleDeleteThread = async () => { if (!window.confirm("Delete this ENTIRE thread?")) return; try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'threads', thread.id)); const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts'), where("threadId", "==", thread.id)); const snapshot = await getDocs(q); const batch = writeBatch(db); snapshot.docs.forEach((doc) => batch.delete(doc.ref)); await batch.commit(); setView('region'); } catch (e) { console.error(e); } };
  const handleCopyUserId = (id) => { navigator.clipboard.writeText(id); setCopiedUserId(id); setTimeout(() => setCopiedUserId(null), 2000); };

  // --- Admin Role Management ---
  const handleUpdateRole = async (newRole) => {
      if (!managingUser) return;
      if (!window.confirm(`Are you sure you want to set ${managingUser.name || 'this user'} to ${newRole.toUpperCase()}?`)) return;
      
      try {
          await setDoc(doc(db, 'artifacts', APP_ID, 'users', managingUser.id, 'settings', 'account'), {
              role: newRole
          }, { merge: true });
          alert(`Success! User is now a ${newRole}.`);
          setManagingUser(null);
      } catch (e) {
          console.error("Role update failed:", e);
          alert(`Failed to update role. Error: ${e.message}`);
      }
  };

  if (!liveThread) return <div className="h-full flex items-center justify-center text-slate-500"><Loader className="animate-spin mr-2"/> Loading...</div>;

  const threadBanner = liveThread.bannerUrl || null;
  const bannerPos = liveThread.bannerPosition || 'center';

  return (
    // FIX: Increased padding to pb-80 (20rem) to account for floating editor + character drawer
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-950 pb-80">
       {/* Thread Banner */}
       {threadBanner && (
         <div className="relative w-full h-64 md:h-96 bg-slate-900 border-b border-amber-900/50 overflow-hidden shrink-0 group">
             <img 
                src={threadBanner} 
                className="w-full h-full object-cover opacity-60 transition-all duration-300" 
                style={{ objectPosition: bannerPos }}
                onError={(e) => e.target.style.display = 'none'}
             />
             <div className="absolute inset-0 bg-linear-to-t from-slate-950 to-transparent" />
             {canEditBanner && (
                 <button onClick={() => setIsEditingBanner(!isEditingBanner)} className="absolute top-4 right-4 p-2 bg-black/60 text-white hover:text-amber-500 rounded-full border border-white/20 transition-all opacity-0 group-hover:opacity-100"><Edit3 className="w-4 h-4" /></button>
             )}
         </div>
       )}

        {isEditingBanner && (
            <div className="bg-slate-900 border-b border-amber-900/30 p-4 animate-in slide-in-from-top-2 relative z-30">
                <div className="max-w-4xl mx-auto space-y-2">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-amber-500 font-bold text-xs uppercase">Edit Thread Banner</h4>
                        <button onClick={() => setIsEditingBanner(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4"/></button>
                    </div>
                    <ImageUploader 
                        initialUrl={liveThread.bannerUrl}
                        initialPosition={liveThread.bannerPosition}
                        folder="thread_banners"
                        shape="banner"
                        onImageChanged={handleBannerUpdate}
                    />
                </div>
            </div>
        )}

       <div className={`flex items-center gap-4 px-4 md:px-8 py-6 ${threadBanner ? 'relative -mt-20 z-10' : 'sticky top-0 bg-slate-950/95 backdrop-blur-md z-20 border-b border-slate-800'}`}>
        <button onClick={() => setView('region')} className={`flex items-center gap-1 ${threadBanner ? "bg-black/50 px-3 py-1 rounded hover:bg-black/70 text-white border-none" : "text-slate-400 hover:text-white"}`}><ChevronLeft className="w-5 h-5" /> Back</button>
        <div className="flex-1">
            <div className="flex items-center gap-3">
                <h1 className={`text-2xl md:text-3xl font-serif font-bold ${threadBanner ? 'text-white drop-shadow-lg' : 'text-amber-100'}`}>{liveThread.title}</h1>
                {!threadBanner && canEditBanner && <button onClick={() => setIsEditingBanner(!isEditingBanner)} className="text-slate-500 hover:text-amber-500"><Edit3 className="w-4 h-4"/></button>}
                {canDeleteThread && <button onClick={handleDeleteThread} className="text-red-900/50 hover:text-red-500" title="Delete Thread"><Trash2 className="w-5 h-5"/></button>}
            </div>
          <div className={`flex items-center gap-2 text-sm ${threadBanner ? 'text-amber-200/80' : 'text-amber-600/60'}`}><MapIcon className="w-3 h-3" /> {region ? region.name : 'Unknown Region'}</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="flex gap-4 md:gap-6 group relative">
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                {user && user.uid === post.userId && !editingPostId && <button onClick={() => handleEditPostStart(post)} className="text-slate-500 hover:text-amber-500 bg-slate-900/50 rounded p-1"><Edit3 className="w-4 h-4"/></button>}
                {isAdminOrMod && !editingPostId && <button onClick={() => handleDeletePost(post.id)} className="text-red-900/50 hover:text-red-500 bg-slate-900/50 rounded p-1"><Trash2 className="w-4 h-4"/></button>}
            </div>
            <div className="flex flex-col items-center gap-2 w-24 shrink-0">
               <div onClick={() => onOpenCodex && onOpenCodex(post.characterId)} className="w-16 h-16 md:w-20 md:h-20 bg-slate-800 rounded-lg border-2 border-slate-700 overflow-hidden shadow-lg relative bg-cover bg-center cursor-pointer hover:border-amber-500 transition-colors">
                 <img src={post.characterImageUrl || ''} className="w-full h-full object-cover" style={{ objectPosition: post.characterImagePosition || 'center' }} onError={(e) => e.target.style.display = 'none'}/>
                 <div className="absolute inset-0 flex items-center justify-center text-3xl bg-slate-700 text-slate-300 font-bold -z-10">{post.characterName ? post.characterName.substring(0,1) : '?'}</div>
               </div>
               <div className="text-center w-full">
                 <div onClick={() => onOpenCodex && onOpenCodex(post.characterId)} className="text-xs font-bold text-amber-500 truncate w-full cursor-pointer hover:underline">{post.characterName}</div>
                 <div className="text-[10px] text-slate-500 uppercase tracking-wider">{post.characterRace} {post.characterClass}</div>
                 
                 {/* ID and Admin Tools */}
                 {isAdminOrMod && (
                    <div className="mt-1 flex flex-wrap justify-center gap-1">
                        <button onClick={() => handleCopyUserId(post.userId)} className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-500 border border-slate-700 rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors">
                            {copiedUserId === post.userId ? <Check className="w-3 h-3 text-emerald-500"/> : <User className="w-3 h-3"/>} ID
                        </button>
                        
                        {/* ROLE BUTTON */}
                        {isAdmin && (
                            <button 
                                onClick={() => setManagingUser({ id: post.userId, name: post.characterName })}
                                className="text-[10px] bg-slate-800 hover:bg-amber-900 text-slate-400 hover:text-amber-500 border border-slate-700 hover:border-amber-700 rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors"
                                title="Manage User Role"
                            >
                                <Shield className="w-3 h-3"/> Role
                            </button>
                        )}
                    </div>
                 )}
               </div>
            </div>
            <div className="flex-1 bg-slate-900/50 border border-slate-800 p-4 md:p-6 rounded-xl rounded-tl-none relative shadow-sm">
              {editingPostId === post.id ? (
                  <div className="space-y-2">
                      <MarkdownEditor value={editPostContent} onChange={(e) => setEditPostContent(e.target.value)} minHeight="min-h-[250px]" />
                      <div className="flex gap-2 justify-end"><button onClick={() => setEditingPostId(null)} className="px-3 py-1 text-slate-400 hover:text-white text-xs">Cancel</button><button onClick={handleEditPostSave} className="px-3 py-1 bg-amber-700 text-white rounded hover:bg-amber-600 text-xs">Save Edits</button></div>
                  </div>
              ) : (
                  <>
                    <div className="prose prose-invert prose-p:text-slate-300 prose-headings:text-amber-100 max-w-none"><RichText content={post.content} className="font-serif text-lg" /></div>
                    <div className="absolute top-2 right-4 flex gap-2 items-center">{post.isEdited && <span className="text-[10px] text-slate-600 italic">(Edited)</span>}<span className="text-[10px] text-slate-700">{formatTimestamp(post.createdAt)}</span></div>
                  </>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* ADMIN ROLE MANAGER MODAL */}
      {managingUser && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-slate-900 border border-amber-900 rounded-xl p-6 max-w-sm w-full shadow-2xl relative">
                  <button onClick={() => setManagingUser(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5"/></button>
                  
                  <div className="flex items-center gap-3 mb-4 text-amber-500">
                      <Gavel className="w-8 h-8"/>
                      <h3 className="text-xl font-bold font-serif">Admin Court</h3>
                  </div>
                  
                  <p className="text-slate-300 mb-6">
                      Assign a new role for the player of <span className="font-bold text-white">{managingUser.name}</span>.
                  </p>
                  
                  <div className="space-y-2">
                      <button onClick={() => handleUpdateRole('user')} className="w-full text-left px-4 py-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex justify-between items-center group">
                          <span>User (Default)</span>
                          <User className="w-4 h-4 opacity-0 group-hover:opacity-100"/>
                      </button>
                      <button onClick={() => handleUpdateRole('moderator')} className="w-full text-left px-4 py-3 rounded bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-900/50 flex justify-between items-center group">
                          <span>Moderator</span>
                          <Shield className="w-4 h-4 opacity-0 group-hover:opacity-100"/>
                      </button>
                      <button onClick={() => handleUpdateRole('admin')} className="w-full text-left px-4 py-3 rounded bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border border-amber-900/50 flex justify-between items-center group">
                          <span>Administrator</span>
                          <ShieldAlert className="w-4 h-4 opacity-0 group-hover:opacity-100"/>
                      </button>
                      <div className="h-px bg-slate-800 my-2"></div>
                      <button onClick={() => handleUpdateRole('banned')} className="w-full text-left px-4 py-3 rounded bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 flex justify-between items-center group">
                          <span>Ban User</span>
                          <Gavel className="w-4 h-4 opacity-0 group-hover:opacity-100"/>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Reply Box */}
      <div className="fixed bottom-16 md:bottom-20 left-0 right-0 p-4 bg-slate-950/95 border-t border-amber-900/30 z-30 backdrop-blur-md transition-all">
        <div className="max-w-4xl mx-auto flex gap-4 items-start">
             <div className="hidden md:block w-12 h-12 bg-slate-800 rounded border border-slate-700 shrink-0 overflow-hidden relative">
                {activeCharId && characters.find(c => c.id === activeCharId) ? (
                  <><img src={characters.find(c => c.id === activeCharId).imageUrl || ''} className="w-full h-full object-cover" style={{ objectPosition: characters.find(c => c.id === activeCharId).imagePosition || 'center' }} onError={(e) => e.target.style.display='none'}/><div className="absolute inset-0 flex items-center justify-center font-bold text-amber-500 bg-slate-800 -z-10">{characters.find(c => c.id === activeCharId).name.substring(0,1)}</div></>
                ) : <div className="w-full h-full flex items-center justify-center text-slate-600"><Ghost className="w-6 h-6"/></div>}
             </div>
             
             {/* REPLY EDITOR WRAPPER */}
             <div className="flex-1 flex flex-col gap-3">
                <MarkdownEditor 
                    value={replyContent} 
                    onChange={(e) => setReplyContent(e.target.value)} 
                    placeholder={activeCharId ? `Reply as ${characters.find(c => c.id === activeCharId)?.name}...` : "Create a character to reply..."}
                    minHeight="min-h-[100px]"
                    onPost={handleReply}
                    submitLabel="Post Reply"
                    disabled={isSending} // Only disable editor if sending
                    isSubmitDisabled={!replyContent.trim() || !activeCharId} // Disable button if empty
                    isSubmitting={isSending}
                />
             </div>
        </div>
      </div>
    </div>
  );
}