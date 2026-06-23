import React, { memo } from 'react';
import { Edit3 } from 'lucide-react';

const CharacterListItem = memo(function CharacterListItem({ char, isActive, onSelect, onEdit }) {
    const handleKeyDown = (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(char.id);
        }
    };

    return (
        <div
            onClick={() => onSelect(char.id)}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-current={isActive ? 'true' : undefined}
            className={`relative p-3 rounded-xl border flex items-center gap-4 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${isActive ? 'bg-amber-900/30 border-amber-500 shadow-lg shadow-amber-900/20' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-500'}`}
        >
            <div className="w-16 h-16 shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-600">
                <img
                    src={char.imageUrl || ''}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: char.imagePosition || 'center' }}
                    onError={(e) => e.target.style.display = 'none'}
                    alt={char.name}
                />
                {!char.imageUrl && <div className="w-full h-full flex items-center justify-center font-bold text-slate-500 text-xl">{char.name[0]}</div>}
            </div>
            <div className="overflow-hidden flex-1">
                <h4 className={`font-bold truncate ${isActive ? 'text-amber-100' : 'text-slate-300'}`}>{char.name}</h4>
                <p className="text-xs text-slate-500">{char.race} {char.class}</p>
                {isActive && <span className="text-[10px] text-amber-500 uppercase font-bold tracking-wider mt-1 block">Active</span>}
            </div>
            <button
                onClick={(e) => onEdit(e, char)}
                className="p-2 text-slate-500 hover:text-amber-500 transition-colors rounded hover:bg-slate-700 focus:outline-none focus:bg-slate-700"
                aria-label={`Edit ${char.name}`}
            >
                <Edit3 className="w-4 h-4" />
            </button>
        </div>
    );
});

export default CharacterListItem;
