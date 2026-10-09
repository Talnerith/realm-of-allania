import { useState, useMemo, useRef, memo } from 'react';
import { Plus, Search, ChevronRight, Loader, AlertCircle, BookOpen } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import useCodexPages from '@/hooks/useCodexPages';
import { hostedImageUrl } from '@/lib/imageUrls';
import {
  CODEX_SECTIONS, CODEX_HERO, sectionForCategory, codexTagStyle, cleanCodexTags,
  MAX_CODEX_TAGS, MAX_CODEX_TAG_LENGTH
} from '@/lib/codex';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Small gold rule with a centre diamond (fixed colours: it sits on the banner)
const BannerRule = () => (
  <svg viewBox="0 0 240 10" aria-hidden="true" className="hidden md:block mt-1 w-60">
    <path d="M0 5h110M130 5h110" stroke="var(--a-600)" strokeWidth="1" />
    <path d="M120 1l4 4-4 4-4-4z" fill="rgb(8 10 15)" stroke="var(--a-400)" strokeWidth="1" />
  </svg>
);

export const CodexTag = ({ label, small = false }) => (
  <span className={`rounded border font-semibold leading-none ${small ? 'px-1.5 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs'}`} style={codexTagStyle(label)}>{label}</span>
);

const thumbOf = (page) => hostedImageUrl(page.imageUrl) || hostedImageUrl((page.gallery || [])[0]);

function SectionCard({ section, pages, query, onOpenEntry }) {
  const listRef = useRef(null);
  const present = new Set(pages.map(p => (p.title || '?').charAt(0).toUpperCase()));
  const seen = new Set();

  const jumpTo = (letter) => {
    const list = listRef.current;
    const li = list?.querySelector(`[data-letter="${letter}"]`);
    if (!li) return;
    if (list.scrollHeight > list.clientHeight + 1) list.scrollTo?.({ top: li.offsetTop - 4, behavior: 'smooth' });
    else li.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative rounded-[14px] bg-(color:--card-bg) border border-gold-900/50 shadow-(--card-shadow) flex flex-col" aria-label={section.title}>
      <div className="relative shrink-0 h-[clamp(140px,4.73vw+121.5px,170px)]">
        <div className="absolute inset-0 overflow-hidden rounded-t-[13px]">
          <picture>
            <source media="(min-width: 768px)" srcSet={section.banner.desktop} />
            <img src={section.banner.mobile} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </picture>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgb(8_10_15/.82)_0%,rgb(8_10_15/.5)_45%,rgb(8_10_15/.1)_78%,transparent_88%),linear-gradient(0deg,var(--card-bg)_0%,transparent_16%)]" />
        </div>
        <div className="absolute flex items-center gap-4 left-3 right-4 -top-3 pointer-events-none">
          <img src={section.medallion} alt="" className="relative shrink-0 self-start w-auto block h-[clamp(3.5rem,4vw+1.5rem,5rem)] drop-shadow-[0_6px_12px_rgb(0_0_0/.5)]" />
          <div className="flex flex-col gap-1 min-w-0 pt-3">
            <h2 className="font-serif font-bold text-3xl leading-none uppercase tracking-[.06em] text-(color:--a-400)">{section.title}</h2>
            <p className="font-serif italic text-base text-white text-pretty">{section.tagline}</p>
          </div>
        </div>
      </div>

      {pages.length > 0 && (
        <nav aria-label={`Jump to letter in ${section.title}`} className="flex flex-wrap gap-0.5 px-4 pb-2 border-b border-ink-800">
          {LETTERS.map(ch => {
            const on = present.has(ch);
            return (
              <button key={ch} type="button" onClick={() => jumpTo(ch)} disabled={!on}
                aria-label={on ? `Jump to ${ch}` : `No ${section.title.toLowerCase()} starting with ${ch}`}
                className={`w-[1.375rem] h-6 rounded text-xs font-semibold flex items-center justify-center transition-colors ${on ? 'text-gold-500 hover:bg-gold-900/30 hover:text-gold-300' : 'text-ink-600 cursor-default'}`}>
                {ch}
              </button>
            );
          })}
        </nav>
      )}

      {pages.length > 0 ? (
        <ul ref={listRef} className="relative flex flex-col px-3 pb-3 lg:max-h-[34rem] lg:overflow-y-auto custom-scrollbar">
          {pages.map(page => {
            const letter = (page.title || '?').charAt(0).toUpperCase();
            const first = !seen.has(letter);
            seen.add(letter);
            const thumb = thumbOf(page);
            const tags = cleanCodexTags(page.tags);
            return (
              <li key={page.id} data-letter={first ? letter : undefined} className="border-b border-ink-800 last:border-b-0">
                <button type="button" onClick={() => onOpenEntry(page)} aria-label={`Open ${page.title}`}
                  className="w-full flex items-center gap-3 rounded-lg p-2 text-left hover:bg-ink-800 transition-colors">
                  <span className="shrink-0 w-12 h-12 rounded overflow-hidden border border-ink-700 bg-ink-800 flex items-center justify-center">
                    {thumb
                      ? <img src={thumb} alt="" className="w-full h-full object-cover" style={{ objectPosition: page.imagePosition || 'center' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      : <BookOpen className="w-5 h-5 text-ink-500" aria-hidden="true" />}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="font-serif text-lg leading-tight text-ink-50 text-pretty">{page.title}</span>
                    {tags.length > 0 && <span className="flex flex-wrap gap-1">{tags.map(t => <CodexTag key={t} label={t} small />)}</span>}
                  </span>
                  {page.isLocked === true && <span className="shrink-0 text-2xs font-bold uppercase text-gold-500 tracking-[.12em]">Sacred</span>}
                  {page.status === 'pending' && <span className="shrink-0 rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-2xs font-semibold text-ink-300">Awaiting approval</span>}
                  <ChevronRight className="w-[18px] h-[18px] shrink-0 text-ink-400" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-6 py-6 text-sm text-ink-400">{query ? `No pages match “${query}”.` : 'No pages here yet.'}</p>
      )}
    </section>
  );
}

function CodexIndex({ onOpenEntry, onRequireAuth }) {
  const { user } = useGame();
  const { pages, loading, error } = useCodexPages();
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState('characters');
  const [newTags, setNewTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  const [createError, setCreateError] = useState(null);

  const q = searchQuery.trim().toLowerCase();
  const bySection = useMemo(() => {
    const out = Object.fromEntries(CODEX_SECTIONS.map(s => [s.id, []]));
    pages.forEach(p => {
      if (q && !`${p.title || ''} ${cleanCodexTags(p.tags).join(' ')}`.toLowerCase().includes(q)) return;
      out[sectionForCategory(p.category).id].push(p);
    });
    return out;
  }, [pages, q]);

  // Tags already used in the chosen section, offered as quick picks
  const sectionTags = useMemo(() => {
    const set = new Set();
    pages.filter(p => sectionForCategory(p.category).id === newSection).forEach(p => cleanCodexTags(p.tags).forEach(t => set.add(t)));
    newTags.forEach(t => set.add(t));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [pages, newSection, newTags]);

  const toggleTag = (label) => setNewTags(prev => (
    prev.includes(label) ? prev.filter(t => t !== label) : prev.length < MAX_CODEX_TAGS ? [...prev, label] : prev
  ));
  const addCustomTag = () => {
    const tag = customTag.trim().slice(0, MAX_CODEX_TAG_LENGTH);
    if (!tag) return;
    if (!newTags.some(t => t.toLowerCase() === tag.toLowerCase()) && newTags.length < MAX_CODEX_TAGS) setNewTags([...newTags, tag]);
    setCustomTag('');
  };

  const startCreate = () => {
    if (!user) { onRequireAuth?.(); return; }
    setCreating(true);
    setCreateError(null);
  };
  const cancelCreate = () => { setCreating(false); setNewTitle(''); setNewTags([]); setCustomTag(''); setCreateError(null); };
  const createPage = () => {
    if (newTitle.trim().length < 3) return setCreateError('Title must be at least 3 characters.');
    const section = CODEX_SECTIONS.find(s => s.id === newSection);
    onOpenEntry({ isNew: true, title: newTitle.trim(), category: section.title, tags: newTags });
  };

  if (loading) return <div className="h-full flex items-center justify-center text-ink-400 bg-ink-950"><Loader className="w-6 h-6 animate-spin mr-2" aria-hidden="true" /> Accessing Archives...</div>;
  if (error) return <div className="h-full flex items-center justify-center text-red-400 bg-ink-950"><AlertCircle className="w-6 h-6 mr-2" aria-hidden="true" /> {error}</div>;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-ink-950">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gold-900/50 bg-[rgb(8_10_15)] h-[max(16rem,21rem-5vw)]">
        <picture>
          <source media="(min-width: 768px)" srcSet={CODEX_HERO.desktop} />
          <img src={CODEX_HERO.mobile} alt="" className="absolute inset-0 w-full h-full object-cover object-[center_40%]" />
        </picture>
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgb(8_10_15/.9)_0%,rgb(8_10_15/.65)_32%,transparent_65%),linear-gradient(0deg,rgb(8_10_15/.5),transparent_45%)]" />
        <div className="absolute inset-0 md:hidden pointer-events-none bg-[rgb(8_10_15/.4)]" />
        <div className="absolute inset-0 flex flex-col md:flex-row md:items-end justify-center md:justify-between gap-4 px-4 md:px-12 py-6 md:py-8">
          <div className="flex flex-col gap-2 min-w-0 md:self-center">
            <h1 className="font-serif font-bold leading-none text-5xl md:text-6xl text-(color:--a-100)">The Codex</h1>
            <p className="font-serif italic text-white text-lg md:text-xl text-pretty">Archives of knowledge, history, and known figures.</p>
            <BannerRule />
          </div>
          <div className="flex items-center gap-3">
            <label className="relative flex items-center flex-1 min-w-0 md:w-64 max-w-full">
              <Search className="absolute left-3 w-4 h-4 text-ink-400 pointer-events-none" aria-hidden="true" />
              <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search the codex…" aria-label="Search codex pages"
                className="w-full bg-ink-950/80 border border-ink-700 rounded-full py-2 pl-9 pr-4 text-sm text-ink-50 focus:border-gold-500 focus:outline-none transition-colors" />
            </label>
            <button type="button" onClick={startCreate} className="flex items-center gap-2 shrink-0 bg-gold-700 hover:bg-gold-600 text-white rounded px-4 py-2 text-sm font-bold transition-colors shadow-[0_8px_20px_-8px_rgb(0_0_0/.6)]">
              <Plus className="w-4 h-4" strokeWidth={2.4} aria-hidden="true" /><span>New Page</span>
            </button>
          </div>
        </div>
      </section>

      <div className="w-full px-3 md:px-8 pt-8 pb-32 flex flex-col gap-6">
        {creating && (
          <section className="rounded-[14px] bg-(color:--card-bg) border border-gold-900/50 shadow-(--card-shadow) p-4 md:p-6 flex flex-col gap-4 max-w-3xl w-full mx-auto" aria-label="New codex page">
            <h2 className="font-serif text-2xl text-gold-100">New codex page</h2>
            <input value={newTitle} onChange={(e) => { setNewTitle(e.target.value); setCreateError(null); }} placeholder="Page title" aria-label="Page title" maxLength={140}
              className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-2 font-serif text-xl text-ink-50 focus:border-gold-500 focus:outline-none transition-colors" />
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-ink-400">Section</span>
              <div className="flex flex-wrap gap-2">
                {CODEX_SECTIONS.map(s => {
                  const on = newSection === s.id;
                  return (
                    <button key={s.id} type="button" onClick={() => { setNewSection(s.id); setNewTags([]); }} aria-pressed={on}
                      className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-gold-700 bg-gold-900/30 text-gold-300' : 'border-ink-700 text-ink-300 hover:text-ink-50'}`}>
                      {s.title}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-ink-400">Tags · up to {MAX_CODEX_TAGS}</span>
              <div className="flex flex-wrap items-center gap-2">
                {sectionTags.map(label => {
                  const on = newTags.includes(label);
                  return (
                    <button key={label} type="button" onClick={() => toggleTag(label)} aria-pressed={on} disabled={!on && newTags.length >= MAX_CODEX_TAGS}
                      className="rounded border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-40"
                      style={on ? codexTagStyle(label) : { background: 'transparent', borderColor: 'var(--color-ink-700)', color: 'var(--color-ink-300)' }}>
                      {label}
                    </button>
                  );
                })}
                <form onSubmit={(e) => { e.preventDefault(); addCustomTag(); }} className="flex items-center gap-1">
                  <input value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="New tag" aria-label="New tag" maxLength={MAX_CODEX_TAG_LENGTH}
                    disabled={newTags.length >= MAX_CODEX_TAGS}
                    className="w-28 bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs text-ink-50 focus:border-gold-500 focus:outline-none disabled:opacity-40" />
                  <button type="submit" disabled={!customTag.trim() || newTags.length >= MAX_CODEX_TAGS} className="rounded border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:text-gold-300 hover:border-gold-700 disabled:opacity-40 transition-colors">Add</button>
                </form>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {createError && <p className="text-xs text-red-400" role="alert">{createError}</p>}
              <p className="text-xs text-ink-400">Next you&apos;ll write the page. New pages appear after a moderator approves them.</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={cancelCreate} className="text-sm text-ink-400 hover:text-ink-50 transition-colors">Cancel</button>
                <button type="button" onClick={createPage} className="bg-gold-700 hover:bg-gold-600 text-white rounded px-4 py-2 text-sm font-bold transition-colors">Create page</button>
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {CODEX_SECTIONS.map(section => (
            <SectionCard key={section.id} section={section} pages={bySection[section.id]} query={searchQuery.trim()} onOpenEntry={onOpenEntry} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(CodexIndex);
