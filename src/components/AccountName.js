import { Pencil } from 'lucide-react';
import Avatar from '@/components/Avatar';

// The account menu's profile block: the player's author picture and name
// (shown on their codex entries) and email, with a button that opens the
// profile editor.
export default function AccountName({ name, email, avatar, onEdit }) {
  return (
    <div className="px-3 py-2 flex items-center gap-3 min-w-0">
      <Avatar name={name} imageUrl={avatar?.url} imagePosition={avatar?.position} className="w-11 h-11 text-xl" />
      <div className="flex-1 min-w-0">
        <div className="text-2xs uppercase tracking-widest text-ink-400">Author</div>
        <div className="text-sm font-medium text-ink-50 truncate">{name}</div>
        {email && <div className="text-xs text-ink-400 truncate">{email}</div>}
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit author profile"
        title="Edit author profile"
        className="shrink-0 p-1.5 rounded text-ink-400 hover:text-gold-400 hover:bg-ink-800 transition-colors"
      >
        <Pencil className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
