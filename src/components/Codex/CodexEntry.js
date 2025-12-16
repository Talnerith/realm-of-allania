import { useState, useEffect } from 'react';
import { ChevronLeft, Edit3, Save, Trash2, Image as ImageIcon, X, ChevronRight, Plus } from 'lucide-react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID, CATEGORIES } from '@/lib/constants';
import ImageUploader from '@/components/ImageUploader';
import MarkdownEditor from '@/components/MarkdownEditor'; 
import RichText from '@/components/RichText'; // <--- ADDED THIS MISSING IMPORT

// Helper for timestamp
const formatTime = (ts) => {
    if (!ts?.toDate) return 'Just now';
    return ts.toDate().toLocaleString();
};

export default function CodexEntry({ page, goBack }) {
  const { user, characters, activeCharId } = useGame();
  
  // State
  const [isEditing, setIsEditing] = useState(page.isNew || false);
  const [title, setTitle] = useState(page.title || '');
  const [category, setCategory] = useState(page.category || 'General');
  const [content, setContent] = useState(page.content || '');
  const [gallery, setGallery] = useState(page.gallery || []);
  
  // Staging state for the Image Uploader
  const [stagedUrl, setStagedUrl] = useState('');

  // Local copy to prevent flicker when saving
  const [localPage, setLocalPage] = useState(page);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (page.isNew) setIsEditing(true);
  }, [page]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return alert("Title and Content required");

    const pageData = {
        title, category, content, gallery,
        updatedAt: serverTimestamp(),
        updatedBy: characters.find(c => c.id === activeCharId)?.name || 'Anonymous'
    };

    try {
        if (localPage.isNew) {
            // Create
            const ref = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'), {
                ...pageData, relatedId: localPage.relatedId || ''
            });
            setLocalPage({ ...pageData, id: ref.id, updatedAt: { toDate: () => new Date() } });
        } else {
            // Update
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages', localPage.id), pageData);
            setLocalPage(prev => ({ ...prev, ...pageData, updatedAt: { toDate: () => new Date() } }));
        }
        setIsEditing(false);
    } catch (e) { console.error(e); }
  };

  // Gallery Handlers
  const handleStagedImage = (url) => {
      setStagedUrl(url);
  };

  const addStagedToGallery = () => {
     if (stagedUrl && !gallery.includes(stagedUrl)) {
         setGallery([...gallery, stagedUrl]);
         setStagedUrl(''); 
     }
  };

  const removeImage = (url) => setGallery(gallery.filter(u => u !== url));

  // Lightbox Handlers
  const openLightbox = (idx) => { setLightboxIndex(idx); setLightboxOpen(true); };
  const nextImage = (e) => { e.stopPropagation(); setLightboxIndex((i) => (i + 1) % gallery.length); };
  const prevImage = (e) => { e.stopPropagation(); setLightboxIndex((i) => (i - 1 + gallery.length) % gallery.length); };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in slide-in-from-right-8 pb-48">
       {/* Lightbox */}
       {lightboxOpen && (
         <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
             <button className="absolute top-4 right-4 text-white hover:text-amber-500"><X className="w-8 h-8"/></button>
             <img src={gallery[lightboxIndex]} className="max-w-full max-h-full object-contain select-none" onClick={(e) => e.stopPropagation()} onError={(e) => {e.target.src='https://placehold.co/800x600/1e293b/FFF?text=Error';}}/>
             {gallery.length > 1 && (
                 <>
                    <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 text-white"><ChevronLeft className="w-10 h-10"/></button>
                    <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 text-white"><ChevronRight className="w-10 h-10"/></button>
                 </>
             )}
         </div>
       )}

       {/* Header Controls */}
       <div className="flex items-center gap-4 mb-6">
          <button onClick={goBack} className="text-slate-400 hover:text-white flex items-center gap-1">
             <ChevronLeft className="w-5 h-5"/> Back to Index
          </button>
          <div className="flex-1"></div>
          {!isEditing ? (
             <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-slate-800 text-slate-200 px-3 py-1 rounded hover:bg-slate-700">
                <Edit3 className="w-4 h-4"/> Edit Page
             </button>
          ) : (
             <div className="flex gap-2">
                <button onClick={() => { if(localPage.isNew) goBack(); else setIsEditing(false); }} className="text-slate-400 hover:text-white">Cancel</button>
                <button onClick={handleSave} className="flex items-center gap-2 bg-amber-700 text-white px-3 py-1 rounded hover:bg-amber-600">
                   <Save className="w-4 h-4"/> Save Changes
                </button>
             </div>
          )}
       </div>

       {/* Content Card */}
       <div className="bg-slate-900 border border-amber-900/30 rounded-xl overflow-hidden shadow-2xl">
          {/* Title Area */}
          <div className="h-32 bg-linear-to-r from-amber-900/20 to-slate-900 border-b border-amber-900/30 p-6 flex items-end">
              <div className="w-full">
                  {isEditing ? (
                      <div className="flex flex-col gap-2">
                          <select className="bg-slate-950/50 border border-amber-900/50 text-amber-500 text-xs font-bold uppercase rounded p-1" value={category} onChange={e => setCategory(e.target.value)}>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input className="bg-transparent border-b border-amber-900/50 text-3xl font-serif font-bold text-amber-100 w-full focus:outline-none focus:border-amber-500" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"/>
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
                        placeholder="Write your lore..."
                        minHeight="min-h-[400px]"
                      />
                      
                      {/* Gallery Editor */}
                      <div className="bg-slate-950 p-4 rounded border border-slate-800">
                          <h4 className="text-amber-500 font-bold mb-4 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Gallery Manager</h4>
                          
                          {/* Image Uploader Integration */}
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
                                      <Plus className="w-4 h-4"/> Add to Gallery
                                  </button>
                              </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                             {gallery.map((url, idx) => (
                                 <div key={idx} className="relative aspect-square rounded overflow-hidden border border-slate-700 group">
                                     <img src={url} className="w-full h-full object-cover" onError={(e) => {e.target.src='https://placehold.co/400x400/1e293b/FFF?text=Error';}}/>
                                     <button onClick={() => removeImage(url)} className="absolute top-1 right-1 bg-red-900/80 text-white p-1 rounded-full"><Trash2 className="w-3 h-3"/></button>
                                 </div>
                             ))}
                             {gallery.length === 0 && <p className="col-span-4 text-center text-slate-500 text-sm italic py-4">No images in gallery yet.</p>}
                          </div>
                      </div>
                  </div>
              ) : (
                  <>
                    <div className="prose prose-invert prose-amber max-w-none whitespace-pre-wrap font-serif text-lg text-slate-300 mb-8"><RichText content={content} /></div>
                    
                    {/* View Mode Gallery */}
                    {gallery.length > 0 && (
                        <div className="border-t border-slate-800 pt-8 mt-8">
                            <h3 className="text-amber-100 font-bold mb-4 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-amber-500"/> Gallery</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {gallery.map((url, idx) => (
                                    <div key={idx} onClick={() => openLightbox(idx)} className="aspect-square rounded border border-slate-700 overflow-hidden cursor-pointer hover:border-amber-500">
                                        <img src={url} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" onError={(e) => {e.target.src='https://placehold.co/400x400/1e293b/FFF?text=Error';}}/>
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
  );
}