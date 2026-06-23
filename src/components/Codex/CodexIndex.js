import { useState, useEffect, useMemo, memo } from 'react';
import { Plus, Book, Loader, AlertCircle, BookLock } from 'lucide-react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID, CATEGORIES } from '@/lib/constants';
import { useGame } from '@/context/GameContext';

function CodexIndex({ onOpenEntry }) {
  const { userRole } = useGame();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdminOrMod = userRole === 'admin' || userRole === 'moderator';

  useEffect(() => {
      const q = query(
          collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'),
          orderBy('title', 'asc')
      );

      const unsub = onSnapshot(q, (snapshot) => {
          let p = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          
          // Filter by status: only show approved for regular users
          // Mods can see all
          if (!isAdminOrMod) {
              p = p.filter(page => page.status === 'approved' || !page.status); // Allow legacy pages without status
          }
          
          setPages(p);
          setLoading(false);
      }, (err) => {
          console.error("Codex Error:", err);
          setError("Failed to load Codex entries.");
          setLoading(false);
      });

      return () => unsub();
  }, [isAdminOrMod]);

  // OPTIMIZATION: Memoize the categorization logic.
  // This prevents rebuilding the entire category structure on every render.
  const categorizedPages = useMemo(() => {
      const cats = {};
      
      // Initialize buckets
      CATEGORIES.forEach(cat => {
        cats[cat] = [];
      });
      cats['Uncategorized'] = [];

      // Sort pages into buckets
      pages.forEach(p => {
        const targetCat = cats[p.category] ? p.category : 'Uncategorized';
        cats[targetCat].push(p);
      });

      return cats;
  }, [pages]);

  if (loading) return <div className="h-full flex items-center justify-center text-slate-500"><Loader className="w-6 h-6 animate-spin mr-2"/> Accessing Archives...</div>;
  if (error) return <div className="h-full flex items-center justify-center text-red-500"><AlertCircle className="w-6 h-6 mr-2"/> {error}</div>;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-950">
        <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in pb-48">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-serif font-bold text-amber-100 mb-2">The Codex</h1>
                    <p className="text-slate-400">Archives of knowledge, history, and known figures.</p>
                </div>
                <button 
                    onClick={() => onOpenEntry({ isNew: true })} 
                    className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded"
                >
                    <Plus className="w-4 h-4"/> New Page
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(categorizedPages).map(([catName, pageList]) => (
                pageList.length > 0 && (
                    <div key={catName} className="space-y-3">
                    <h3 className="text-amber-500 font-bold uppercase tracking-widest border-b border-amber-900/50 pb-2">{catName}</h3>
                    {pageList.map(page => (
                        <div 
                        key={page.id}
                        onClick={() => onOpenEntry(page)}
                        className="group flex items-center gap-3 p-2 rounded hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                        {page.isLocked ? (
                            <BookLock className="w-4 h-4 text-amber-600 group-hover:text-amber-400" title="Sacred Text" />
                        ) : (
                            <Book className="w-4 h-4 text-slate-600 group-hover:text-amber-400" />
                        )}
                        <span className="text-slate-300 group-hover:text-amber-100">{page.title}</span>
                        {page.isLocked && (
                            <span className="text-[10px] text-amber-600/70 uppercase tracking-wider">Sacred</span>
                        )}
                        </div>
                    ))}
                    </div>
                )
                ))}
            </div>
        </div>
    </div>
  );
}

export default memo(CodexIndex);