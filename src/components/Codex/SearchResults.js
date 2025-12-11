import { Search, ExternalLink } from 'lucide-react';

export default function SearchResults({ query, results, openPage, openThread }) {
  // Helper for timestamp
  const formatTime = (ts) => {
    if (!ts?.toDate) return 'Recent';
    return ts.toDate().toLocaleDateString();
  };

  return (
    <div className="max-w-4xl mx-auto p-8 animate-in fade-in pb-48">
      <h2 className="text-2xl font-serif font-bold text-amber-100 mb-6 flex items-center gap-2">
         <Search className="w-6 h-6 text-amber-500"/> Search Results: "{query}"
      </h2>

      <div className="space-y-8">
         {/* Codex Matches */}
         <div className="space-y-4">
             <h3 className="text-amber-500 font-bold uppercase tracking-widest border-b border-amber-900/50 pb-2">
                 Codex Entries ({results.pages.length})
             </h3>
             {results.pages.length === 0 && <p className="text-slate-500 text-sm">No matches found.</p>}
             {results.pages.map(page => (
                 <div key={page.id} onClick={() => openPage(page)} className="bg-slate-900/50 border border-slate-700 p-4 rounded hover:border-amber-500 cursor-pointer transition-colors">
                     <h3 className="font-bold text-amber-100">{page.title}</h3>
                     <p className="text-slate-400 text-sm line-clamp-2">{page.content}</p>
                 </div>
             ))}
         </div>

         {/* Forum Matches */}
         <div className="space-y-4">
             <h3 className="text-amber-500 font-bold uppercase tracking-widest border-b border-amber-900/50 pb-2">
                 Forum Posts ({results.posts.length})
             </h3>
             {results.posts.length === 0 && <p className="text-slate-500 text-sm">No matches found.</p>}
             {results.posts.map(post => (
                 <div key={post.id} onClick={() => openThread(post)} className="bg-slate-900/50 border border-slate-700 p-4 rounded hover:border-amber-500 cursor-pointer group transition-colors">
                     <div className="flex items-center gap-2 mb-1">
                         <span className="text-amber-200 font-bold text-sm">{post.characterName}</span>
                         <span className="text-slate-500 text-xs">• {formatTime(post.createdAt)}</span>
                     </div>
                     <p className="text-slate-300 text-sm italic">"{post.content}"</p>
                     <div className="mt-2 text-xs text-amber-600 group-hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3"/> Jump to Thread</div>
                 </div>
             ))}
         </div>
      </div>
    </div>
  );
}