import { memo } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { timeAgo, plainText } from '@/lib/utils';
import Avatar from '@/components/Avatar';

const MAX_ITEMS = 6;

// "Recent activity": unread posts by others in the active character's threads
// `collapsible` renders a <details> card (stacked layouts)
function ActivityPanel({ character, activity, onOpenThread, onMarkAllRead, showExcerpts = true, collapsible = false, className = '' }) {
  const items = activity.slice(0, MAX_ITEMS);
  const count = activity.length;

  const header = (
    <div className="flex items-center gap-2">
      <Clock className="w-[18px] h-[18px] text-gold-500 shrink-0" aria-hidden="true" />
      <h2 className="font-serif text-xl text-gold-100 flex-1">Recent activity</h2>
      {count > 0 && <span className="rounded-full bg-gold-700 text-white text-2xs font-bold px-2 py-0.5 tabular-nums">{count} new</span>}
      {collapsible && <ChevronDown className="w-4 h-4 text-ink-400 shrink-0" aria-hidden="true" />}
    </div>
  );
  const body = (
    <>
      <p className="text-xs text-ink-400">
        {character ? `Unread posts where ${character.name.split(' ')[0]} is writing.` : 'Choose a character to follow their threads.'}
      </p>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {items.map(a => (
            <li key={a.id}>
              <button type="button" onClick={() => onOpenThread(a.thread)} className="w-full text-left flex gap-3 rounded-lg p-2 hover:bg-ink-800 transition-colors">
                <Avatar name={a.by} imageUrl={a.image} imagePosition={a.imagePosition} className="w-8 h-8 text-base" />
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-base leading-tight text-gold-500 truncate flex-1 min-w-0">{a.by}</span>
                    <span className="text-2xs text-ink-400 shrink-0">{timeAgo(a.at)}</span>
                  </div>
                  <span className="text-xs text-ink-400 truncate">in {a.threadTitle}</span>
                  {showExcerpts && a.content && (
                    <span className="font-serif italic text-sm text-ink-300 line-clamp-2">{plainText(a.content, 140)}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : character && (
        <p className="font-serif italic text-lg text-ink-300 text-center py-4">All caught up.</p>
      )}
      {count > 0 && onMarkAllRead && (
        <button type="button" onClick={onMarkAllRead} className="self-start text-xs text-gold-500 hover:text-gold-300 transition-colors">Mark all read</button>
      )}
    </>
  );
  const cardCls = `rounded-[14px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow) p-4 ${className}`;

  if (collapsible) {
    return (
      <details className={cardCls} aria-label="Recent activity">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{header}</summary>
        <div className="flex flex-col gap-3 pt-3">{body}</div>
      </details>
    );
  }
  return (
    <section className={`${cardCls} flex flex-col gap-3`} aria-label="Recent activity">
      {header}
      {body}
    </section>
  );
}

export default memo(ActivityPanel);
