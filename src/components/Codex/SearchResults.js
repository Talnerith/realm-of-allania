import { useState, useEffect } from 'react';
import { collection, query, getDocs, limit, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { useGame } from '@/context/GameContext';
import { Loader, FileText, MessageSquare, AlertCircle, Search, WifiOff, MessageCircle } from 'lucide-react';
import { filterCodexResults, filterThreadResults, filterPostResults, getSnippet } from '@/lib/searchUtils';
import { isHostedImageUrl } from '@/lib/imageUrls';

export default function SearchResults({ query: searchQuery, onNavigate, onOpenThread, onOpenCodex }) {
  const { user, userRole } = useGame();
  const [results, setResults] = useState({ threads: [], codex: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    // Don't search if empty, but clear results
    if (!searchQuery) {
        setLoading(false);
        return;
    }

    const performSearch = async () => {
      setLoading(true);
      setSearchError(null);
      // NOTE: query lowercasing is now handled inside filter functions in searchUtils
      
      try {
        // Security rules deny reading unapproved docs, so non-mods search
        // approved content only; mods search everything
        const isMod = userRole === 'admin' || userRole === 'moderator';
        const codexRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages');
        const threadsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'threads');
        const postsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'posts');

        // 1. Search Codex (Fetch metadata and filter client-side)
        const codexQ = isMod
          ? query(codexRef, limit(100))
          : query(codexRef, where('status', '==', 'approved'), limit(100));

        // 2. Search Threads (Fetch recent threads)
        const threadsQ = isMod
          ? query(threadsRef, orderBy('updatedAt', 'desc'), limit(50))
          : query(threadsRef, where('status', '==', 'approved'), orderBy('updatedAt', 'desc'), limit(50));

        // 3. Search Individual Posts (Fetch recent posts - Deep Search)
        const postsQ = isMod
          ? query(postsRef, orderBy('createdAt', 'desc'), limit(100))
          : query(postsRef, where('status', '==', 'approved'), orderBy('createdAt', 'desc'), limit(100));

        // Execute all fetches in parallel
        const [codexSnap, threadsSnap, postsSnap] = await Promise.all([
            getDocs(codexQ),
            getDocs(threadsQ),
            getDocs(postsQ)
        ]);

        // Visibility context: hide pending/rejected content from non-owners/non-mods
        const viewer = {
          userId: user?.uid || null,
          isMod: userRole === 'admin' || userRole === 'moderator'
        };

        // Filter Codex
        const codexResults = filterCodexResults(codexSnap.docs, searchQuery, viewer);

        // Filter Thread Titles
        const threadResults = filterThreadResults(threadsSnap.docs, searchQuery, viewer);

        // Filter Post Content
        const postResults = filterPostResults(postsSnap.docs, searchQuery, viewer);

        setResults({ threads: threadResults, codex: codexResults, posts: postResults });

      } catch (e) {
        console.error("Search error:", e);
        if (e.message && (e.message.includes('offline') || e.message.includes('client'))) {
            setSearchError("Connection blocked. Please disable ad-blockers for Firestore.");
        } else {
            setSearchError("Failed to search archives. The library is closed.");
        }
      } finally {
        setLoading(false);
      }
    };

    // Small delay to allow UI to settle before firing network request
    const timer = setTimeout(() => {
        performSearch();
    }, 100); 

    return () => clearTimeout(timer);
  }, [searchQuery, user?.uid, userRole]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-ink-950 p-6 md:p-12 animate-in slide-in-from-bottom-2">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-serif font-bold text-gold-100 mb-2 flex items-center gap-3">
            <Search className="w-8 h-8 text-gold-500"/>
            Search Results
        </h2>
        <p className="text-ink-500 mb-8 border-b border-ink-800 pb-4">
            Showing results for &quot;<span className="text-ink-50">{searchQuery}</span>&quot;
        </p>

        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gold-500">
                <Loader className="w-8 h-8 animate-spin mb-4"/>
                <p>Scouring the archives...</p>
            </div>
        ) : searchError ? (
             <div className="text-center py-12 bg-red-900/20 rounded-xl border border-red-900/50">
                <WifiOff className="w-12 h-12 text-red-500 mx-auto mb-3"/>
                <p className="text-red-400 font-bold mb-2">Search Failed</p>
                <p className="text-ink-500 text-sm">{searchError}</p>
            </div>
        ) : (
            <div className="space-y-8 pb-20">
                {/* NO RESULTS */}
                {results.threads.length === 0 && results.codex.length === 0 && results.posts.length === 0 && (
                    <div className="text-center py-12 bg-ink-900/50 rounded-xl border border-dashed border-ink-800">
                        <AlertCircle className="w-12 h-12 text-ink-600 mx-auto mb-3"/>
                        <p className="text-ink-400">No records found matching your query.</p>
                    </div>
                )}

                {/* CODEX RESULTS */}
                {results.codex.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-ink-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <FileText className="w-4 h-4"/> Codex Entries ({results.codex.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.codex.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => onOpenCodex(item)}
                                    className="bg-ink-900 border border-ink-800 hover:border-gold-500 p-4 rounded-lg cursor-pointer transition-colors group"
                                >
                                    <div className="text-xs text-gold-600 font-bold uppercase mb-1">{item.category}</div>
                                    <h4 className="text-lg font-serif font-bold text-ink-200 group-hover:text-gold-100">{item.title}</h4>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* THREAD TITLES */}
                {results.threads.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-ink-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4"/> Forum Threads ({results.threads.length})
                        </h3>
                        <div className="space-y-3">
                            {results.threads.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => onOpenThread(item)}
                                    className="bg-ink-900/50 border border-ink-800 hover:bg-ink-800 p-4 rounded-lg cursor-pointer flex justify-between items-center group"
                                >
                                    <div>
                                        <h4 className="font-bold text-ink-300 group-hover:text-gold-400">{item.title}</h4>
                                        <p className="text-xs text-ink-600 mt-1">Started by {item.createdBy}</p>
                                    </div>
                                    <div className="text-ink-600 group-hover:text-gold-500">
                                        <MessageSquare className="w-5 h-5"/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* POST MATCHES (NEW) */}
                {results.posts.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-ink-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4"/> Matching Posts ({results.posts.length})
                        </h3>
                        <div className="space-y-3">
                            {results.posts.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => onOpenThread({ id: item.threadId })} // Navigate to thread using ID
                                    className="bg-ink-900/30 border border-ink-800/50 hover:bg-ink-900 hover:border-gold-900 p-4 rounded-lg cursor-pointer group transition-colors"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-5 h-5 rounded overflow-hidden bg-ink-800">
                                            {isHostedImageUrl(item.characterImageUrl) && <img src={item.characterImageUrl} alt={item.characterName} className="w-full h-full object-cover"/>}
                                        </div>
                                        <span className="text-xs font-bold text-gold-600">{item.characterName}</span>
                                        <span className="text-xs text-ink-600">• in a thread</span>
                                    </div>
                                    <p className="text-sm text-ink-300 italic">
                                        &quot;{getSnippet(item.content, searchQuery)}&quot;
                                    </p>
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