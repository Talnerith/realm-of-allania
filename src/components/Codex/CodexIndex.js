import { Plus, Book } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants';

export default function CodexIndex({ pages, openPage, createPage }) {
  // Dynamically build categories based on constants
  // This ensures "Bestiary", "Magic", etc. show up automatically
  const categories = {};
  CATEGORIES.forEach(cat => {
    categories[cat] = [];
  });
  
  // Fallback bucket for anything that doesn't match
  categories['Uncategorized'] = [];

  pages.forEach(p => {
    // Check if the page's category exists in our defined list
    const cat = categories[p.category] ? p.category : 'Uncategorized';
    categories[cat].push(p);
  });

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in pb-48">
      <div className="flex justify-between items-center mb-8">
          <div>
              <h1 className="text-4xl font-serif font-bold text-amber-100 mb-2">The Codex</h1>
              <p className="text-slate-400">Archives of knowledge, history, and known figures.</p>
          </div>
          <button 
             onClick={createPage}
             className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded"
          >
             <Plus className="w-4 h-4"/> New Page
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(categories).map(([catName, pageList]) => (
          pageList.length > 0 && (
            <div key={catName} className="space-y-3">
              <h3 className="text-amber-500 font-bold uppercase tracking-widest border-b border-amber-900/50 pb-2">{catName}</h3>
              {pageList.map(page => (
                <div 
                  key={page.id}
                  onClick={() => openPage(page)}
                  className="group flex items-center gap-3 p-2 rounded hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <Book className="w-4 h-4 text-slate-600 group-hover:text-amber-400" />
                  <span className="text-slate-300 group-hover:text-amber-100">{page.title}</span>
                </div>
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
}