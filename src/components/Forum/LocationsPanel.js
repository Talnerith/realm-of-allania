import { memo } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

const cardCls = 'rounded-[14px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow)';

const firstName = (name = '') => name.split(' ')[0];

export const locationSummary = (locations) => {
  const turns = locations.filter(l => l.yourTurn).length;
  return `${locations.length} ${locations.length === 1 ? 'thread' : 'threads'}${turns ? ` · ${turns} your turn` : ''}`;
};

function LocationList({ locations, currentThreadId, regionName, onOpenThread }) {
  return (
    <ul className="flex flex-col gap-1">
      {locations.map(loc => {
        const current = loc.id === currentThreadId;
        return (
          <li key={loc.id}>
            <button
              type="button"
              onClick={() => onOpenThread(loc.thread)}
              aria-current={current ? 'page' : undefined}
              className={`w-full text-left rounded-lg px-3 py-3 flex flex-col items-start gap-1 transition-colors ${current ? 'bg-gold-900/30 text-gold-100' : 'text-ink-100 hover:bg-ink-800'}`}
            >
              <span className="flex items-start gap-2 w-full">
                <span className="font-serif text-lg leading-snug flex-1 min-w-0 text-pretty">{loc.title}</span>
                {loc.unread > 0 && (
                  <span className="mt-1 rounded-full bg-gold-700 text-white text-2xs font-bold px-1.5 tabular-nums shrink-0" aria-label={`${loc.unread} unread`}>
                    {loc.unread >= 5 ? '5+' : loc.unread}
                  </span>
                )}
              </span>
              <span className="text-2xs uppercase tracking-wider text-gold-500 leading-snug">{regionName(loc.regionId)}</span>
              <span className="flex flex-wrap items-center gap-2 text-2xs">
                <span className={loc.yourTurn ? 'font-bold uppercase tracking-wider text-gold-400' : 'uppercase tracking-wider text-ink-400'}>{loc.status}</span>
                <span className="text-ink-600" aria-hidden="true">·</span>
                <span className="text-ink-400">{timeAgo(loc.lastAt)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CharacterBadge({ character, size = 'lg' }) {
  return (
    <div className={`${size === 'lg' ? 'w-12 h-12 text-xl' : 'w-10 h-10 text-lg'} rounded-full bg-ink-800 border border-gold-700 flex items-center justify-center font-serif font-bold text-gold-300 shrink-0`} aria-hidden="true">
      {character?.name?.charAt(0) || '?'}
    </div>
  );
}

// "Locations": the threads the active character writes in, whose turn it is,
// and unread counts. `collapsible` renders the mobile <details> version.
function LocationsPanel({ character, locations, loading, currentThreadId, regionName, onOpenThread, collapsible = false, className = '' }) {
  const summary = character ? (loading ? 'Loading…' : locationSummary(locations)) : 'No character selected';
  const empty = !character
    ? 'Choose a character in the roster below to see where they are writing.'
    : loading ? null : 'No threads yet. Post in a thread and it will appear here.';

  const body = (
    <>
      {locations.length > 0
        ? <LocationList locations={locations} currentThreadId={currentThreadId} regionName={regionName} onOpenThread={onOpenThread} />
        : empty && <p className="text-sm text-ink-400 px-1">{empty}</p>}
    </>
  );

  if (collapsible) {
    return (
      <details className={`${cardCls} ${className}`}>
        <summary className="flex items-center gap-3 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <CharacterBadge character={character} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink-50">{character ? `${firstName(character.name)}'s locations` : 'Locations'}</div>
            <div className="text-xs text-ink-400">{summary}</div>
          </div>
          <ChevronDown className="w-[18px] h-[18px] text-ink-400 shrink-0" aria-hidden="true" />
        </summary>
        <div className="px-2 pb-2">{body}</div>
      </details>
    );
  }

  return (
    <section className={`${cardCls} p-4 flex flex-col gap-4 ${className}`} aria-label="Character locations">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-400">
        <MapPin className="w-4 h-4" aria-hidden="true" />
        <span>Locations</span>
      </div>
      {character && (
        <div className="flex items-center gap-3">
          <CharacterBadge character={character} />
          <div className="min-w-0">
            <div className="font-serif text-xl leading-tight text-gold-100">{character.name}</div>
            <div className="text-2xs uppercase tracking-wider text-ink-400">{[character.race, character.class].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      )}
      {character && <p className="text-xs text-ink-400">{summary}</p>}
      {body}
    </section>
  );
}

export default memo(LocationsPanel);
