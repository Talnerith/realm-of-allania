import React, { memo } from 'react';
import { Edit3 } from 'lucide-react';
import { hostedImageUrl } from '@/lib/imageUrls';

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
            className={`relative p-3 rounded-xl border flex items-center gap-4 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-gold-500 ${isActive ? 'bg-gold-900/30 border-gold-500 shadow-lg shadow-gold-900/20' : 'bg-ink-800/50 border-ink-700 hover:bg-ink-800 hover:border-ink-500'}`}
        >
            <div className="w-16 h-16 shrink-0 bg-ink-900 rounded-lg overflow-hidden border border-ink-600">
                {hostedImageUrl(char.imageUrl) ? (
                    <img
                        src={hostedImageUrl(char.imageUrl)}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: char.imagePosition || 'center' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        alt={char.name}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center font-serif font-bold text-ink-400 text-2xl" aria-hidden="true">{char.name?.[0]}</div>
                )}
            </div>
            <div className="overflow-hidden flex-1">
                <h4 className={`font-bold truncate ${isActive ? 'text-gold-100' : 'text-ink-300'}`}>{char.name}</h4>
                <p className="text-xs text-ink-500">{char.race} {char.class}</p>
                {isActive && <span className="text-2xs text-gold-500 uppercase font-bold tracking-wider mt-1 block">Active</span>}
            </div>
            <button
                onClick={(e) => onEdit(e, char)}
                className="p-2 text-ink-500 hover:text-gold-500 transition-colors rounded hover:bg-ink-700 focus:outline-none focus:bg-ink-700"
                aria-label={`Edit ${char.name}`}
            >
                <Edit3 className="w-4 h-4" />
            </button>
        </div>
    );
});

export default CharacterListItem;
