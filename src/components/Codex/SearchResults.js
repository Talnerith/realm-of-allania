import { useState, useEffect } from 'react';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { Loader, FileText, MessageSquare, AlertCircle, Search } from 'lucide-react';

export default function SearchResults({ query: searchQuery, onNavigate, onOpenThread, onOpenCodex }) {
  const [results, setResults] = useState({ threads: [], codex: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!searchQuery) return;

    const performSearch = async () => {
      setLoading(true);
      const lowerQuery = searchQuery.toLowerCase();
      
      try {
        // 1. Search Codex (Fetch metadata and filter client-side)
        // We fetch the last 100 entries to keep it fast. For larger apps, use Algolia.
        const codexQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'), limit(100));
        const codexSnap = await getDocs(codexQ);
        const codexResults = codexSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(item => 
                (item.title && item.title.toLowerCase().includes(lowerQuery)) || 
                (item.category && item.category.toLowerCase().includes(lowerQuery))
            );

        // 2. Search Threads (Fetch recent threads)
        const threadsQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads'), orderBy('updatedAt', 'desc'), limit(50));
        const threadsSnap = await getDocs(threadsQ);
        const threadResults = threadsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(item => 
                (item.title && item.title.toLowerCase().includes(lowerQuery))
            );

        setResults({ threads: threadResults, codex: codexResults });

      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
        performSearch();
    }, 500); // Debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-950 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-serif font-bold text-amber-100 mb-2 flex items-center gap-3">
            <Search className="w-8 h-8 text-amber-500"/>
            Search Results
        </h2>
        <p className="text-slate-500 mb-8 border-b border-slate-800 pb-4">
            Showing results for "<span className="text-white">{searchQuery}</span>"
        </p>

        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-amber-500">
                <Loader className="w-8 h-8 animate-spin mb-4"/>
                <p>Scouring the archives...</p>
            </div>
        ) : (
            <div className="space-y-8">
                {/* NO RESULTS */}
                {results.threads.length === 0 && results.codex.length === 0 && (
                    <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                        <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3"/>
                        <p className="text-slate-400">No records found matching your query.</p>
                    </div>
                )}

                {/* CODEX RESULTS */}
                {results.codex.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <FileText className="w-4 h-4"/> Codex Entries ({results.codex.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.codex.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => onOpenCodex(item)}
                                    className="bg-slate-900 border border-slate-800 hover:border-amber-500 p-4 rounded-lg cursor-pointer transition-colors group"
                                >
                                    <div className="text-xs text-amber-600 font-bold uppercase mb-1">{item.category}</div>
                                    <h4 className="text-lg font-serif font-bold text-slate-200 group-hover:text-amber-100">{item.title}</h4>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* THREAD RESULTS */}
                {results.threads.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4"/> Forum Threads ({results.threads.length})
                        </h3>
                        <div className="space-y-3">
                            {results.threads.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => onOpenThread(item)}
                                    className="bg-slate-900/50 border border-slate-800 hover:bg-slate-800 p-4 rounded-lg cursor-pointer flex justify-between items-center group"
                                >
                                    <div>
                                        <h4 className="font-bold text-slate-300 group-hover:text-amber-400">{item.title}</h4>
                                        <p className="text-xs text-slate-600 mt-1">Started by {item.createdBy}</p>
                                    </div>
                                    <div className="text-slate-600 group-hover:text-amber-500">
                                        <MessageSquare className="w-5 h-5"/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}