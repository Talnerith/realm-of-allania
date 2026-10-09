import { useState, useMemo, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, ChevronDown, Pencil, Trash2, Lock, Unlock, X, Plus, AlertCircle,
    PersonStanding, Swords, Map as MapIcon, Castle, Crown, Gem, ScrollText, Link2, Images, BookOpen
} from 'lucide-react';
import { doc, updateDoc, addDoc, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import { hostedImageUrl } from '@/lib/imageUrls';
import {
    CODEX_SECTIONS, sectionForCategory, parseCodexContent, cleanCodexTags, codexTagStyle,
    MAX_CODEX_TAGS, MAX_CODEX_TAG_LENGTH, newPageTemplate, stripEmptyFacts
} from '@/lib/codex';
import { useProfile, authorName } from '@/lib/profiles';
import useCodexPages from '@/hooks/useCodexPages';
import useMediaQuery from '@/hooks/useMediaQuery';
import ImageUploader from '@/components/ImageUploader';
import MarkdownEditor from '@/components/MarkdownEditor';
import RichText from '@/components/RichText';
import Avatar from '@/components/Avatar';
import DropCap from '@/components/Codex/DropCap';

const cardCls = 'rounded-[14px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow)';
const fieldCls = 'w-full bg-ink-800 border border-ink-700 rounded px-3 py-2 text-ink-50 focus:border-gold-500 focus:outline-none transition-colors';
const labelCls = 'text-xs uppercase tracking-widest text-ink-400';

const FACT_ICONS = { race: PersonStanding, class: Swords, region: MapIcon, type: Castle, governance: Crown };
const factIcon = (label) => FACT_ICONS[label.toLowerCase()] || Gem;

// Longest opening paragraph shown as the blurb (about two sentences)
const BLURB_MAX = 320;

// The entry's short summary beside its facts: an italic note with a gold edge
function Blurb({ content, onWikiLink }) {
    return (
        <div className="min-w-0 flex-[1_1_16rem] border-l-2 border-gold-700 bg-ink-900/40 rounded-r px-5 py-4">
            <RichText content={content} className="font-serif italic text-lg md:text-xl leading-snug text-(color:--story)" onWikiLink={onWikiLink} />
        </div>
    );
}

const thumbOf = (page) => hostedImageUrl(page?.imageUrl) || hostedImageUrl((page?.gallery || [])[0]);

const Diamond = ({ className = '' }) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`absolute w-6 h-6 left-[calc(50%-12px)] z-[1] ${className}`}>
        <path d="M12 1l11 11-11 11L1 12z" fill="var(--color-ink-950)" stroke="var(--color-gold-600)" strokeWidth="1.2" />
        <path d="M12 6l6 6-6 6-6-6z" fill="#f6f1e4" stroke="var(--color-gold-300)" strokeWidth=".8" />
    </svg>
);

// Gold-framed 3:4.6 portrait with white crystals on the top and bottom edges
function Portrait({ url, position, title, className = '' }) {
    return (
        <div className={`relative ${className}`}>
            <div className="relative w-full p-[5px] border border-gold-700">
                <div className="relative w-full aspect-[3/4.6] bg-ink-900 overflow-hidden border border-gold-900 flex items-center justify-center">
                    {url
                        ? <img src={url} alt={title} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: position || 'center' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        : <span className="font-serif font-bold text-6xl text-gold-500" aria-hidden="true">{(title || '?').charAt(0)}</span>}
                </div>
                <Diamond className="-top-3" />
                <Diamond className="-bottom-3" />
            </div>
        </div>
    );
}

const PanelRule = ({ edge }) => (
    <svg viewBox="0 0 60 10" aria-hidden="true" className={`absolute w-15 left-[calc(50%-1.875rem)] ${edge === 'top' ? '-top-[5px]' : '-bottom-[5px]'}`}>
        <path d="M0 5h22M38 5h22" stroke="var(--color-gold-700)" strokeWidth="1" />
        <path d="M30 1l4 4-4 4-4-4z" fill="var(--color-ink-950)" stroke="var(--color-gold-500)" strokeWidth="1" />
    </svg>
);

export default function CodexEntry({ page = {}, goBack, onWikiLink, onOpenEntry }) {
    const { user, characters, activeCharId, userRole } = useGame();
    const { pages } = useCodexPages();
    const wide = useMediaQuery('(min-width: 1280px)');
    const sideBySide = useMediaQuery('(min-width: 900px)');

    // Edit state
    const [isEditing, setIsEditing] = useState(page.isNew || false);
    const [title, setTitle] = useState(page.title || '');
    const [category, setCategory] = useState(page.category || 'Characters');
    const [tags, setTags] = useState(cleanCodexTags(page.tags));
    const [customTag, setCustomTag] = useState('');
    const [content, setContent] = useState(page.content || (page.isNew ? newPageTemplate(page.category) : ''));
    const [gallery, setGallery] = useState(page.gallery || []);
    const [portrait, setPortrait] = useState({ url: page.imageUrl || '', position: page.imagePosition || 'center' });
    const [error, setError] = useState('');

    const [stagedUrl, setStagedUrl] = useState('');
    // Uploads made during this edit, deleted if it's cancelled
    const [sessionUploads, setSessionUploads] = useState([]);
    // A double click must not add the page twice
    const [saving, setSaving] = useState(false);

    // Local copy to prevent flicker when saving
    const [localPage, setLocalPage] = useState(page);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const galleryRef = useRef(null);

    const isAdminOrMod = userRole === 'admin' || userRole === 'moderator';
    const isLocked = localPage.isLocked === true;
    const canEdit = !!user && (isAdminOrMod || !isLocked);

    const section = sectionForCategory(isEditing ? category : localPage.category);
    const parsed = useMemo(() => parseCodexContent(localPage.content || ''), [localPage.content]);
    const author = useProfile(localPage.creatorId);
    const authorLabel = authorName(author);

    // The author's other entries in this section, and the pages this one links to
    const authorEntries = useMemo(() => pages.filter(p =>
        localPage.creatorId && p.creatorId === localPage.creatorId && sectionForCategory(p.category).id === section.id
    ), [pages, localPage.creatorId, section.id]);
    const related = useMemo(() => parsed.related
        .map(t => pages.find(p => (p.title || '').toLowerCase() === t.toLowerCase()))
        .filter(p => p && p.id !== localPage.id), [parsed.related, pages, localPage.id]);

    // Facts beside the opening (Characters: Race and Class; Locations: three;
    // History: none); Quick Facts lists them all
    const keyFacts = parsed.facts.slice(0, section.keyFacts);
    const quickFacts = parsed.facts;
    // A short opening paragraph is the entry's blurb, set apart beside the
    // facts; a longer one simply starts the text (with the drop cap)
    const [opening = '', ...rest] = parsed.paragraphs;
    const summary = opening.length <= BLURB_MAX ? opening : '';
    const bodyParas = summary ? rest : parsed.paragraphs;
    const portraitUrl = hostedImageUrl(localPage.imageUrl) || hostedImageUrl((localPage.gallery || [])[0]);
    const viewGallery = (localPage.gallery || []).map(hostedImageUrl).filter(Boolean);

    const handleSave = async () => {
        if (saving) return;
        setError('');
        if (!user) return setError("You must be signed in to save.");
        if (!title.trim()) return setError("Title is required.");
        const text = stripEmptyFacts(content);
        if (!text.trim() || text.length < 10) return setError("Content must be at least 10 characters.");
        if (gallery.length > 5) return setError("Gallery cannot exceed 5 images.");

        // Everything but mod edits is checked by the moderation function first
        // (trusted users only skip its AI step, so they're approved in seconds)
        const isTrusted = userRole === 'trusted' || isAdminOrMod;
        const status = isAdminOrMod ? 'approved' : 'pending';

        const pageData = {
            title: title.trim(), category, tags: cleanCodexTags(tags), content: text, gallery,
            imageUrl: portrait.url || '', imagePosition: portrait.position || 'center',
            updatedAt: serverTimestamp(),
            updatedBy: characters.find(c => c.id === activeCharId)?.name || 'Anonymous',
            lastEditorId: user.uid
        };

        setSaving(true);
        try {
            if (localPage.isNew) {
                const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages'), {
                    ...pageData,
                    status,
                    relatedId: localPage.relatedId || '',
                    creatorId: user.uid,
                    createdAt: serverTimestamp()
                });
                setLocalPage({ ...pageData, status, creatorId: user.uid, id: docRef.id, updatedAt: { toDate: () => new Date(), toMillis: () => Date.now() } });
                if (!isTrusted) alert("Your codex entry has been submitted for moderation. It will be reviewed shortly.");
            } else {
                // Non-mods must send the page back to 'pending' (the rules require
                // it). If the edit fails moderation, the function restores the last
                // approved version, so the page never goes offline.
                await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages', localPage.id), {
                    ...pageData,
                    ...(!isAdminOrMod && { status: 'pending' })
                });
                setLocalPage(prev => ({ ...prev, ...pageData, updatedAt: { toDate: () => new Date(), toMillis: () => Date.now() } }));
            }

            // Now that the save committed, delete this edit's uploads that didn't
            // make it onto the page. Saved images that were removed stay: the
            // portrait and gallery may share a file with the character, so the
            // weekly orphaned-image cleanup removes them once nothing uses them.
            const kept = new Set([pageData.imageUrl, ...(pageData.gallery || [])]);
            for (const url of sessionUploads) {
                if (kept.has(url)) continue;
                try { await deleteObject(ref(storage, url)); } catch (e) { console.warn("Cleanup failed:", e); }
            }
            setSessionUploads([]);
            setIsEditing(false);
        } catch (e) {
            console.error(e);
            setError("Save failed: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async () => {
        for (const url of sessionUploads) {
            try { await deleteObject(ref(storage, url)); } catch { console.log("Cleanup: File already gone or failed", url); }
        }
        setSessionUploads([]);
        setStagedUrl('');
        // Discard staged edits (removed images were never deleted)
        setGallery(localPage.gallery || []);
        setPortrait({ url: localPage.imageUrl || '', position: localPage.imagePosition || 'center' });
        if (localPage.isNew) goBack(); else setIsEditing(false);
    };

    const handleDelete = async () => {
        if (!isAdminOrMod) return;
        if (!window.confirm("Are you sure you want to delete this Codex Entry? This cannot be undone.")) return;
        try {
            // Images stay (a gallery image may be a character's portrait); the
            // weekly orphaned-image cleanup removes the ones nothing uses
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages', localPage.id));
            goBack();
        } catch (e) {
            console.error("Delete failed:", e);
            alert("Failed to delete. You may not have permission.");
        }
    };

    const handleToggleLock = async () => {
        if (!isAdminOrMod) return;
        const newLockState = !isLocked;
        if (!window.confirm(newLockState
            ? 'Seal this page as a Sacred Text? Players will not be able to edit it.'
            : 'Unseal this page? Players will be able to edit it again.')) return;
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'codex_pages', localPage.id), {
                isLocked: newLockState,
                lockedAt: newLockState ? serverTimestamp() : null,
                lockedBy: newLockState ? user.uid : null
            });
            setLocalPage(prev => ({ ...prev, isLocked: newLockState }));
        } catch (e) {
            console.error(e);
            alert("Failed to update lock status.");
        }
    };

    // Section picker keeps an existing category that already belongs to the section
    const pickSection = (s) => setCategory(prev => (sectionForCategory(prev).id === s.id ? prev : s.title));

    const toggleTag = (label) => setTags(prev => prev.filter(t => t !== label));
    const addTag = () => {
        const tag = customTag.trim().slice(0, MAX_CODEX_TAG_LENGTH);
        if (tag && tags.length < MAX_CODEX_TAGS && !tags.some(t => t.toLowerCase() === tag.toLowerCase())) setTags([...tags, tag]);
        setCustomTag('');
    };

    const handleStagedImage = (url) => { setStagedUrl(url); setSessionUploads(prev => [...prev, url]); };
    const addStagedToGallery = () => {
        if (gallery.length >= 5) return setError("Maximum 5 images allowed in gallery.");
        if (stagedUrl && !gallery.includes(stagedUrl)) { setGallery([...gallery, stagedUrl]); setStagedUrl(''); setError(''); }
    };
    const removeImage = (url) => {
        setGallery(gallery.filter(u => u !== url));
    };
    // The old portrait is never deleted here: character entries share the
    // character's own portrait file
    const handlePortrait = (url, position) => {
        if (url && url !== portrait.url) setSessionUploads(prev => [...prev, url]);
        setPortrait({ url, position });
    };

    const scrollGallery = (dir) => galleryRef.current?.scrollBy?.({ left: dir * 160, behavior: 'smooth' });
    const openEntry = (p) => onOpenEntry?.(p);

    /* ---------- Edit mode ---------- */
    if (isEditing) {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar bg-ink-950">
                <div className="max-w-4xl mx-auto px-3 md:px-8 pt-8 pb-32 flex flex-col gap-6">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={handleCancel} className="text-ink-400 hover:text-ink-50 flex items-center gap-1 text-sm"><ChevronLeft className="w-4 h-4" aria-hidden="true" /> Cancel</button>
                        <h1 className="flex-1 font-serif text-2xl text-gold-100 text-center">{localPage.isNew ? 'New codex page' : 'Edit codex page'}</h1>
                        <button type="button" onClick={handleSave} disabled={saving} className="bg-gold-700 hover:bg-gold-600 disabled:opacity-60 text-white rounded px-4 py-2 text-sm font-bold transition-colors">{saving ? 'Saving…' : 'Save page'}</button>
                    </div>
                    {error && <p role="alert" className="flex items-center gap-2 text-sm text-red-400 bg-red-950 border border-red-900 rounded px-3 py-2"><AlertCircle className="w-4 h-4" aria-hidden="true" />{error}</p>}

                    <section className={`${cardCls} p-4 md:p-6 flex flex-col gap-5`}>
                        <label className="flex flex-col gap-2">
                            <span className={labelCls}>Title</span>
                            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={140} className={`${fieldCls} font-serif text-2xl`} />
                        </label>
                        <div className="flex flex-col gap-2">
                            <span className={labelCls}>Section</span>
                            <div className="flex flex-wrap gap-2">
                                {CODEX_SECTIONS.map(s => {
                                    const on = sectionForCategory(category).id === s.id;
                                    return (
                                        <button key={s.id} type="button" onClick={() => pickSection(s)} aria-pressed={on}
                                            className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-gold-700 bg-gold-900/30 text-gold-300' : 'border-ink-700 text-ink-300 hover:text-ink-50'}`}>
                                            {s.title}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className={labelCls}>Tags · up to {MAX_CODEX_TAGS}</span>
                            <div className="flex flex-wrap items-center gap-2">
                                {tags.map(t => (
                                    <button key={t} type="button" onClick={() => toggleTag(t)} aria-label={`Remove tag ${t}`} className="flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-semibold" style={codexTagStyle(t)}>
                                        {t}<X className="w-3 h-3" aria-hidden="true" />
                                    </button>
                                ))}
                                {tags.length < MAX_CODEX_TAGS && (
                                    <form onSubmit={(e) => { e.preventDefault(); addTag(); }} className="flex items-center gap-1">
                                        <input value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="Add a tag" aria-label="Add a tag" maxLength={MAX_CODEX_TAG_LENGTH}
                                            className="w-32 bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs text-ink-50 focus:border-gold-500 focus:outline-none" />
                                        <button type="submit" disabled={!customTag.trim()} className="rounded border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:text-gold-300 hover:border-gold-700 disabled:opacity-40 transition-colors">Add</button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className={`${cardCls} p-4 md:p-6 flex flex-col gap-3`}>
                        <span className={labelCls}>Page text</span>
                        <p className="text-xs text-ink-400 leading-relaxed">
                            Lines like <code className="text-gold-300">**Race:** Human</code> become facts (the first three sit beside the opening, the rest under Quick Facts).
                            A <code className="text-gold-300">&gt; quote</code> at the very top shows under the title, and one at the very end closes the page.
                            <code className="text-gold-300"> [[Other Page]]</code> links appear under Related Entries.
                        </p>
                        <MarkdownEditor value={content} onChange={e => setContent(e.target.value)} placeholder="Write your lore (Min 10 characters)..." minHeight="min-h-[400px]" onWikiLink={onWikiLink} />
                        <div className="text-right text-2xs text-ink-400">{content.length} / 10000 chars</div>
                    </section>

                    <section className={`${cardCls} p-4 md:p-6 flex flex-col gap-3`}>
                        <span className={labelCls}>Portrait</span>
                        <p className="text-xs text-ink-400">Shown in the gold frame beside the entry (3:4.6). Without one, the first gallery image is used.</p>
                        <ImageUploader initialUrl={portrait.url} initialPosition={portrait.position} onImageChanged={handlePortrait} folder="codex_gallery" shape="square" />
                    </section>

                    <section className={`${cardCls} p-4 md:p-6 flex flex-col gap-4`}>
                        <div className="flex justify-between items-center">
                            <span className={`${labelCls} flex items-center gap-2`}><Images className="w-4 h-4" aria-hidden="true" /> Gallery</span>
                            <span className={`text-xs font-bold ${gallery.length >= 5 ? 'text-red-400' : 'text-ink-400'}`}>{gallery.length}/5 images</span>
                        </div>
                        {gallery.length < 5 && (
                            <div className="flex flex-col gap-3">
                                <ImageUploader initialUrl={stagedUrl} onImageChanged={handleStagedImage} folder="codex_gallery" shape="square" />
                                <div className="flex justify-end">
                                    <button type="button" onClick={addStagedToGallery} disabled={!stagedUrl} className="bg-gold-700 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm flex items-center gap-2">
                                        <Plus className="w-4 h-4" aria-hidden="true" /> Add to Gallery
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                            {gallery.map((url, idx) => (
                                <div key={url} className="relative aspect-square rounded overflow-hidden border border-ink-700">
                                    <img src={hostedImageUrl(url)} alt={`Gallery image ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                                    <button type="button" onClick={() => removeImage(url)} aria-label={`Remove gallery image ${idx + 1}`} className="absolute top-1 right-1 bg-red-900/80 text-white p-1 rounded-full"><Trash2 className="w-3 h-3" aria-hidden="true" /></button>
                                </div>
                            ))}
                            {gallery.length === 0 && <p className="col-span-full text-center text-ink-400 text-sm italic py-4">No images in gallery yet.</p>}
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    /* ---------- Reading mode ---------- */
    const rosterPanel = (
        <AuthorEntries collapsible={!wide} author={author} title={`${authorLabel}'s ${section.title}`} noun={section.id === 'history' ? ['entry', 'entries'] : [section.title.toLowerCase().replace(/s$/, ''), section.title.toLowerCase()]}
            entries={authorEntries} currentId={localPage.id} onOpen={openEntry} />
    );
    const portraitEl = (
        <Portrait url={portraitUrl} position={localPage.imagePosition} title={localPage.title}
            className={sideBySide ? `shrink-0 w-[clamp(15rem,20vw,19rem)] ${section.portraitSide === 'left' ? 'order-first' : ''}` : 'self-center w-full max-w-[22rem] my-3'} />
    );

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-ink-950">
            {/* Lightbox */}
            {lightboxIndex !== null && viewGallery[lightboxIndex] && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxIndex(null)} role="dialog" aria-label="Gallery image">
                    <button type="button" onClick={() => setLightboxIndex(null)} aria-label="Close" className="absolute top-4 right-4 text-white hover:text-(color:--a-400)"><X className="w-8 h-8" /></button>
                    <img src={viewGallery[lightboxIndex]} alt={`Gallery image ${lightboxIndex + 1}`} className="max-w-full max-h-full object-contain select-none" onClick={(e) => e.stopPropagation()} />
                    {viewGallery.length > 1 && (
                        <>
                            <button type="button" aria-label="Previous image" onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i - 1 + viewGallery.length) % viewGallery.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white"><ChevronLeft className="w-10 h-10" /></button>
                            <button type="button" aria-label="Next image" onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i + 1) % viewGallery.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white"><ChevronRight className="w-10 h-10" /></button>
                        </>
                    )}
                </div>
            )}

            {/* Banner */}
            <section className="relative overflow-hidden border-b border-gold-900/50 bg-[rgb(8_10_15)] h-[clamp(14rem,12vw+7rem,18rem)]">
                <picture>
                    <source media="(min-width: 768px)" srcSet={section.banner.desktop} />
                    <img src={section.banner.mobile} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </picture>
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgb(8_10_15/.92)_0%,rgb(8_10_15/.7)_38%,rgb(8_10_15/.1)_75%),linear-gradient(0deg,rgb(8_10_15/.55),transparent_55%)]" />
                <div className="absolute inset-0 flex items-center px-4 md:px-8 lg:px-12">
                    <div className="flex items-center gap-4 md:gap-6 min-w-0 max-w-[52rem]">
                        <img src={section.medallion} alt="" className="shrink-0 w-auto block h-[clamp(4.5rem,4vw+3rem,112px)] drop-shadow-[0_10px_18px_rgb(0_0_0/.5)]" />
                        <div className="flex flex-col gap-2 min-w-0">
                            <nav aria-label="Breadcrumb">
                                <ol className="flex flex-wrap items-center gap-2 text-sm">
                                    <li className="flex items-center gap-2">
                                        <button type="button" onClick={goBack} className="text-white/80 hover:text-(color:--a-200) transition-colors">Codex</button>
                                        <ChevronRight className="w-3 h-3 text-white/50" strokeWidth={2.4} aria-hidden="true" />
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <button type="button" onClick={goBack} className="text-white/80 hover:text-(color:--a-200) transition-colors">{section.title}</button>
                                        <ChevronRight className="w-3 h-3 text-white/50" strokeWidth={2.4} aria-hidden="true" />
                                    </li>
                                    <li aria-current="page" className="truncate max-w-[22rem] text-(color:--a-300)">{localPage.title}</li>
                                </ol>
                            </nav>
                            <h1 className="font-serif font-bold leading-none text-4xl md:text-6xl text-(color:--a-100) text-balance [text-shadow:0_2px_18px_rgb(0_0_0/.4)]">{localPage.title}</h1>
                            {parsed.epigraph && <p className="font-serif italic text-white text-lg md:text-xl text-pretty max-w-[34rem]">“{parsed.epigraph}”</p>}
                            <svg viewBox="0 0 240 10" aria-hidden="true" className="hidden md:block mt-1 w-60">
                                <path d="M0 5h110M130 5h110" stroke="var(--a-600)" strokeWidth="1" />
                                <path d="M120 1l4 4-4 4-4-4z" fill="rgb(8 10 15)" stroke="var(--a-400)" strokeWidth="1" />
                            </svg>
                        </div>
                    </div>
                </div>
                {(isAdminOrMod || isLocked || localPage.status === 'pending') && (
                    <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-2">
                        {localPage.status === 'pending' && <span className="rounded-full bg-black/60 border border-white/20 px-3 py-1.5 text-xs text-white/90">Awaiting approval</span>}
                        {isLocked && <span className="flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-3 py-1.5 text-xs text-(color:--a-300)"><Lock className="w-3.5 h-3.5" aria-hidden="true" /> Sacred Text</span>}
                        {isAdminOrMod && !localPage.isNew && (
                            <>
                                <button type="button" onClick={handleToggleLock} className="flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-3 py-1.5 text-xs text-white/90 hover:text-(color:--a-300) transition-colors">
                                    {isLocked ? <Unlock className="w-3.5 h-3.5" aria-hidden="true" /> : <Lock className="w-3.5 h-3.5" aria-hidden="true" />}{isLocked ? 'Unseal' : 'Seal'}
                                </button>
                                <button type="button" onClick={handleDelete} className="flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-3 py-1.5 text-xs text-red-300 hover:text-red-200 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
                                </button>
                            </>
                        )}
                    </div>
                )}
            </section>

            <div className={wide ? 'w-full px-3 md:px-6 pt-6 pb-32 flex items-start gap-6' : 'w-full px-3 md:px-6 pt-4 pb-32 flex flex-col gap-4'}>
                <aside className={wide ? 'sticky top-6 flex flex-col shrink-0 w-60' : 'order-1 flex flex-col w-full'} aria-label={`${authorLabel}'s ${section.title}`}>
                    {rosterPanel}
                </aside>

                <main className={`flex-1 min-w-0 w-full ${wide ? '' : 'order-2'}`}>
                    <article className="relative rounded-[14px] bg-(color:--card-bg) border border-gold-900/50 shadow-(--card-shadow) p-5 md:p-8 flex flex-col gap-6">
                        {['top-1.5 left-1.5 border-t border-l', 'top-1.5 right-1.5 border-t border-r', 'bottom-1.5 left-1.5 border-b border-l', 'bottom-1.5 right-1.5 border-b border-r'].map(c => (
                            <span key={c} aria-hidden="true" className={`absolute w-[18px] h-[18px] border-gold-700 ${c}`} />
                        ))}
                        <div className={sideBySide ? 'flex items-start gap-8' : 'flex flex-col gap-6'}>
                            <div className="flex flex-col gap-6 min-w-0 flex-1">
                                {(keyFacts.length > 0 || summary) && (
                                    <div className="flex flex-wrap gap-6 items-start">
                                        {keyFacts.length > 0 && (
                                            <dl className="flex flex-col gap-4 shrink-0">
                                                {keyFacts.map(f => {
                                                    const Icon = factIcon(f.label);
                                                    return (
                                                        <div key={f.label} className="flex items-center gap-3">
                                                            <span className="w-10 h-10 rounded-full border border-gold-900/50 bg-ink-900 flex items-center justify-center text-gold-500 shrink-0" aria-hidden="true">
                                                                <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                                                            </span>
                                                            <div>
                                                                <dt className="font-serif font-bold text-lg leading-tight text-gold-500">{f.label}</dt>
                                                                <dd className="text-sm text-ink-100"><FactValue value={f.value} onWikiLink={onWikiLink} /></dd>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </dl>
                                        )}
                                        {summary && <Blurb content={summary} onWikiLink={onWikiLink} />}
                                    </div>
                                )}
                                {!sideBySide && portraitEl}
                                {bodyParas.length > 0 && (
                                    <div className="flex flex-col gap-4 text-base md:text-lg leading-relaxed text-(color:--story)">
                                        {bodyParas.map((para, i) => {
                                            // The opening letter becomes a drop cap (and is hidden in the text)
                                            const dropCap = i === 0 && /^[A-Za-z]/.test(para) ? para[0] : null;
                                            return (
                                                <div key={i}>
                                                    {dropCap && <DropCap letter={dropCap} />}
                                                    <RichText
                                                        content={para}
                                                        onWikiLink={onWikiLink}
                                                        className={dropCap ? '[&>p:first-child]:first-letter:text-[length:0]' : ''}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {sideBySide && portraitEl}
                        </div>

                        {viewGallery.length > 0 && (
                            <div className="flex flex-col gap-4 pt-6 border-t border-ink-800">
                                <div className="flex items-center gap-2">
                                    <Images className="w-[18px] h-[18px] text-gold-500" strokeWidth={1.8} aria-hidden="true" />
                                    <h2 className="font-serif text-xl text-gold-100 flex-1">Gallery</h2>
                                    <button type="button" onClick={() => scrollGallery(-1)} aria-label="Scroll gallery left" className="p-1.5 rounded border border-ink-700 text-ink-300 hover:text-gold-300 hover:border-gold-700 transition-colors"><ChevronLeft className="w-4 h-4" strokeWidth={2.4} aria-hidden="true" /></button>
                                    <button type="button" onClick={() => scrollGallery(1)} aria-label="Scroll gallery right" className="p-1.5 rounded border border-ink-700 text-ink-300 hover:text-gold-300 hover:border-gold-700 transition-colors"><ChevronRight className="w-4 h-4" strokeWidth={2.4} aria-hidden="true" /></button>
                                </div>
                                <div ref={galleryRef} className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory custom-scrollbar">
                                    {viewGallery.map((url, idx) => (
                                        <button key={url} type="button" onClick={() => setLightboxIndex(idx)} aria-label={`Open gallery image ${idx + 1}`}
                                            className="shrink-0 w-38 h-32 rounded border border-ink-700 bg-ink-900 overflow-hidden snap-start hover:border-gold-500 transition-colors">
                                            <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 border-t border-ink-800 text-xs text-ink-400">
                            <span className="flex items-center gap-2">
                                <Avatar name={author?.displayName} imageUrl={author?.avatarUrl} imagePosition={author?.avatarPosition} className="w-6 h-6 text-xs" />
                                <span>Written by <span className="text-gold-500">{authorLabel}</span></span>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Last updated {timeAgo(localPage.updatedAt)}</span>
                            {canEdit && (
                                <button type="button" onClick={() => setIsEditing(true)} className="ml-auto flex items-center gap-2 rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-200 hover:border-gold-700 hover:text-gold-300 transition-colors">
                                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" /><span>Edit entry</span>
                                </button>
                            )}
                        </footer>
                    </article>
                </main>

                <aside className={wide ? 'sticky top-6 flex flex-col shrink-0 w-68' : 'order-3 flex flex-col w-full'} aria-label="Quick facts and related entries">
                    <section className={`relative ${cardCls} p-5 flex flex-col gap-5`}>
                        <PanelRule edge="top" />
                        {cleanCodexTags(localPage.tags).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {cleanCodexTags(localPage.tags).map(t => <span key={t} className="rounded border px-2.5 py-1 text-xs font-semibold leading-none" style={codexTagStyle(t)}>{t}</span>)}
                            </div>
                        )}
                        <div className="flex flex-col gap-3">
                            <h2 className="flex items-center gap-2 font-serif text-xl text-gold-100"><ScrollText className="w-[18px] h-[18px] text-gold-500" strokeWidth={1.8} aria-hidden="true" /><span>Quick Facts</span></h2>
                            {quickFacts.length > 0 ? (
                                <ul className="flex flex-col gap-2">
                                    {quickFacts.map(f => (
                                        <li key={f.label} className="flex items-start gap-2 text-sm">
                                            <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" className="shrink-0 mt-1.5"><path d="M4 0l4 4-4 4-4-4z" fill="var(--color-gold-600)" /></svg>
                                            <span><span className="text-gold-500">{f.label}:</span> <span className="text-ink-100"><FactValue value={f.value} onWikiLink={onWikiLink} /></span></span>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-sm text-ink-400">No facts recorded yet. Add lines like **Race:** Human.</p>}
                        </div>
                        <div className="h-px bg-ink-800" />
                        <div className="flex flex-col gap-3">
                            <h2 className="flex items-center gap-2 font-serif text-xl text-gold-100"><Link2 className="w-[18px] h-[18px] text-gold-500" strokeWidth={1.8} aria-hidden="true" /><span>Related Entries</span></h2>
                            {related.length > 0 ? (
                                <ul className="flex flex-col gap-1">
                                    {related.map(p => {
                                        const thumb = thumbOf(p);
                                        const tag = cleanCodexTags(p.tags)[0];
                                        return (
                                            <li key={p.id}>
                                                <button type="button" onClick={() => openEntry(p)} className="w-full flex items-center gap-3 rounded-lg p-2 text-left hover:bg-ink-800 transition-colors">
                                                    <span className="shrink-0 w-11 h-11 rounded overflow-hidden border border-ink-700 bg-ink-800 flex items-center justify-center">
                                                        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <BookOpen className="w-4 h-4 text-ink-500" aria-hidden="true" />}
                                                    </span>
                                                    <span className="flex-1 min-w-0 flex flex-col">
                                                        <span className="font-serif text-lg leading-tight text-ink-50">{p.title}</span>
                                                        <span className="text-xs text-ink-400">{[sectionForCategory(p.category).title, tag].filter(Boolean).join(' · ')}</span>
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : <p className="text-sm text-ink-400">Link other pages with [[Page Title]] to list them here.</p>}
                        </div>
                        {parsed.closing && (
                            <>
                                <div className="h-px bg-ink-800" />
                                <p className="font-serif italic text-lg text-ink-200 text-center text-balance">“{parsed.closing}”</p>
                            </>
                        )}
                        <PanelRule edge="bottom" />
                    </section>
                </aside>
            </div>
        </div>
    );
}

// A fact value with its [[Wiki Links]] as links, and markdown emphasis dropped
function FactValue({ value, onWikiLink }) {
    const parts = String(value).replace(/[*_`]/g, '').split(/(\[\[[^\]]+\]\])/g);
    return parts.map((part, i) => {
        const m = part.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
        if (!m) return part;
        return (
            <button key={i} type="button" onClick={() => onWikiLink?.(m[1].trim())} className="text-gold-500 hover:text-gold-300 underline-offset-2 hover:underline transition-colors">
                {(m[2] || m[1]).trim()}
            </button>
        );
    });
}

// "<Author>'s <Section>": the author's other pages in this section
function AuthorEntries({ author, title, noun, entries, currentId, onOpen, collapsible }) {
    const list = entries.length > 0 ? (
        <ul className="flex flex-col p-2 gap-1">
            {entries.map(p => {
                const current = p.id === currentId;
                const thumb = thumbOf(p);
                return (
                    <li key={p.id}>
                        <button type="button" onClick={() => !current && onOpen(p)} aria-current={current ? 'page' : undefined}
                            className={`w-full flex items-center gap-3 rounded-lg p-2 text-left transition-colors ${current ? 'bg-gold-900/30 text-gold-100' : 'text-ink-100 hover:bg-ink-800'}`}>
                            <span className="shrink-0 w-11 h-11 rounded overflow-hidden border border-ink-700 bg-ink-800 flex items-center justify-center">
                                {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <BookOpen className="w-4 h-4 text-ink-500" aria-hidden="true" />}
                            </span>
                            <span className="font-serif text-lg leading-tight flex-1 min-w-0">{p.title}</span>
                        </button>
                    </li>
                );
            })}
        </ul>
    ) : <p className="p-4 text-sm text-ink-400">No other entries yet.</p>;
    const header = (
        <>
            {author?.avatarUrl && <Avatar name={author.displayName} imageUrl={author.avatarUrl} imagePosition={author.avatarPosition} className="w-10 h-10 text-lg" />}
            <span className="flex-1 min-w-0 flex flex-col">
                <span className="font-serif font-bold text-lg uppercase leading-tight tracking-[.06em] text-gold-500">{title}</span>
                <span className="text-2xs text-ink-400">{entries.length} {entries.length === 1 ? noun[0] : noun[1]}</span>
            </span>
        </>
    );
    if (collapsible) {
        return (
            <details className={`${cardCls} overflow-hidden`}>
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    {header}<ChevronDown className="w-4 h-4 text-ink-400" aria-hidden="true" />
                </summary>
                <div className="border-t border-ink-800">{list}</div>
            </details>
        );
    }
    return (
        <section className={`${cardCls} flex flex-col overflow-hidden`}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-800">{header}</div>
            {list}
        </section>
    );
}
