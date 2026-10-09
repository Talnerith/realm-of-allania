import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import ImageUploader from '@/components/ImageUploader';

export const AVATAR_FOLDER = 'author_avatars';

const btnCls = 'rounded px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50';

// Removing an old picture must never block saving: failures are only logged
function deleteUpload(url) {
  if (!storage || !url) return;
  deleteObject(ref(storage, url)).catch(e => {
    if (e?.code !== 'storage/object-not-found') console.warn('Could not delete old picture:', e);
  });
}

// Only files in an author_avatars folder are ours to delete
const isAvatarUpload = (url) => typeof url === 'string' && url.includes(`%2F${AVATAR_FOLDER}%2F`);

// Dialog for the player's author profile: picture (uploaded to their own
// Storage folder and checked by moderateImage) and author name.
export default function ProfileEditor({ name, avatar, onSaveName, onSaveAvatar, onClose }) {
  const [draftName, setDraftName] = useState(name || '');
  const [picture, setPicture] = useState(avatar || { url: '', position: 'center' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Pictures uploaded while the dialog is open, deleted unless saved
  const uploads = useRef(new Set());

  const cancel = () => {
    uploads.current.forEach(deleteUpload);
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) cancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const handleImageChanged = (url, position) => {
    if (url && url !== avatar?.url) uploads.current.add(url);
    setPicture({ url: url || '', position: position || 'center' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (draftName.trim() !== name) await onSaveName(draftName);
      if (picture.url !== (avatar?.url || '') || picture.position !== (avatar?.position || 'center')) {
        await onSaveAvatar(picture.url, picture.position);
        if (avatar?.url && avatar.url !== picture.url && isAvatarUpload(avatar.url)) deleteUpload(avatar.url);
      }
      uploads.current.forEach(url => { if (url !== picture.url) deleteUpload(url); });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save your profile.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) cancel(); }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-editor-title"
        onSubmit={handleSubmit}
        className="w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[14px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow) p-5 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="profile-editor-title" className="font-serif text-2xl text-gold-100">Author profile</h2>
          <button type="button" onClick={cancel} disabled={saving} aria-label="Close" className="p-1.5 rounded text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <section aria-label="Picture" className="flex flex-col gap-2">
          <div className="text-2xs uppercase tracking-widest text-ink-400">Picture</div>
          <ImageUploader initialUrl={picture.url} initialPosition={picture.position} folder={AVATAR_FOLDER} shape="circle" onImageChanged={handleImageChanged} />
          {picture.url && (
            <button type="button" onClick={() => setPicture({ url: '', position: 'center' })} className="self-center text-xs text-ink-400 hover:text-red-400 transition-colors">
              Remove picture
            </button>
          )}
        </section>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-author-name" className="text-2xs uppercase tracking-widest text-ink-400">Author name</label>
          <input
            id="profile-author-name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={30}
            autoComplete="nickname"
            aria-describedby="profile-author-name-hint"
            className="w-full rounded-md bg-ink-950 border border-ink-700 focus:border-gold-500 focus:outline-none px-3 py-2 text-base lg:text-sm text-ink-50"
          />
          <p id="profile-author-name-hint" className="text-2xs text-ink-400">Shown with your picture on your Codex entries. 2–30 characters.</p>
        </div>

        {error && <p role="alert" className="text-sm text-red-400 light:text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={cancel} disabled={saving} className={`${btnCls} text-ink-300 hover:bg-ink-800`}>Cancel</button>
          <button type="submit" disabled={saving} className={`${btnCls} bg-gold-700 text-white hover:bg-gold-600`}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
