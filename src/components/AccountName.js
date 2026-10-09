import { useState } from 'react';
import { Pencil } from 'lucide-react';

const btnCls = 'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50';

// The account menu's name block: the player's author name (shown on their
// codex entries) and email, with an inline editor for the name.
export default function AccountName({ name, email, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const startEditing = () => { setDraft(name || ''); setError(''); setEditing(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (draft.trim() === name) { setEditing(false); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Could not save your name.');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="px-3 py-2 flex flex-col gap-2">
        <label htmlFor="account-author-name" className="text-2xs uppercase tracking-widest text-ink-400">Author name</label>
        <input
          id="account-author-name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={30}
          autoFocus
          autoComplete="nickname"
          aria-describedby="account-author-name-hint"
          className="w-full rounded-md bg-ink-950 border border-ink-700 focus:border-gold-500 focus:outline-none px-2.5 py-1.5 text-base lg:text-sm text-ink-50"
        />
        <p id="account-author-name-hint" className="text-2xs text-ink-400">Shown on your Codex entries. 2–30 characters.</p>
        {error && <p role="alert" className="text-xs text-red-400 light:text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} disabled={saving} className={`${btnCls} text-ink-300 hover:bg-ink-800`}>Cancel</button>
          <button type="submit" disabled={saving} className={`${btnCls} bg-gold-700 text-white hover:bg-gold-600`}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="px-3 py-2 min-w-0">
      <div className="text-2xs uppercase tracking-widest text-ink-400">Author name</div>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-ink-50 truncate">{name}</span>
        <button
          type="button"
          onClick={startEditing}
          aria-label="Change author name"
          title="Change author name"
          className="shrink-0 p-1 rounded text-ink-400 hover:text-gold-400 hover:bg-ink-800 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
      {email && <div className="text-xs text-ink-400 truncate">{email}</div>}
    </div>
  );
}
