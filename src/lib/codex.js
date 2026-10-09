import { CODEX_ART } from '@/lib/artAssets';

// The Codex is shown in three sections. Pages keep their stored category;
// each category belongs to one section here (change the grouping in one
// place). New pages store the section title as their category.
export const CODEX_SECTIONS = [
  {
    id: 'characters', title: 'Characters', tagline: 'People, races, and notable figures of Allania.',
    categories: ['Characters', 'Species', 'In-Character Journals', 'Character Resources'],
    medallion: CODEX_ART.characters.medallion,
    banner: CODEX_ART.characters.banner,
    portraitSide: 'right',
    keyFacts: 2, // Race, Class
    templateFacts: ['Race', 'Class'],
  },
  {
    id: 'locations', title: 'Locations', tagline: 'Cities, regions, and places across Allania.',
    categories: ['Locations', 'Regions'],
    medallion: CODEX_ART.locations.medallion,
    banner: CODEX_ART.locations.banner,
    portraitSide: 'right',
    keyFacts: 3, // Region, Type, Governance
    templateFacts: ['Region', 'Type', 'Governance'],
  },
  {
    id: 'history', title: 'History', tagline: 'Faiths, events, and the shaping of the world.',
    categories: ['History', 'Organizations', 'Magic and Powers', 'Quests/Story Arcs', 'Items and Equipment', 'Culture and Society', 'OOC Notes/Guides'],
    medallion: CODEX_ART.history.medallion,
    banner: CODEX_ART.history.banner,
    portraitSide: 'left',
    keyFacts: 0,
  },
];

export const CODEX_HERO = CODEX_ART.hero;

export const MAX_CODEX_TAGS = 3;
// Longest page text the rules accept (isValidContent)
export const MAX_CODEX_LENGTH = 10000;
export const MAX_CODEX_TAG_LENGTH = 24;

// Unknown or missing categories land in History
export const sectionForCategory = (category) =>
  CODEX_SECTIONS.find(s => s.categories.includes(category)) || CODEX_SECTIONS[2];

export const sectionById = (id) => CODEX_SECTIONS.find(s => s.id === id) || CODEX_SECTIONS[0];

// A new page starts with its section's fact lines, blank, to fill in
export function newPageTemplate(category) {
  const labels = sectionForCategory(category).templateFacts || [];
  return labels.length ? `${labels.map(l => `**${l}:** `).join('\n')}\n\n` : '';
}

// Template fact lines left blank are dropped when saving. Only the template's
// own labels: a bold line like "**Chapter One:**" is the writer's heading.
const TEMPLATE_LABELS = new Set(CODEX_SECTIONS.flatMap(s => s.templateFacts || []).map(l => l.toLowerCase()));
export const stripEmptyFacts = (content) =>
  String(content).replace(/^[ \t]*\*\*([^*:\n]{1,40}):\*\*[ \t]*(?:\r?\n|$)/gm,
    (line, label) => (TEMPLATE_LABELS.has(label.trim().toLowerCase()) ? '' : line));

// Free-text tags get a stable hue from their text
const HUES = [25, 60, 95, 150, 185, 215, 250, 285, 320, 350];
const hueOf = (label) => {
  let h = 0;
  for (const c of String(label)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
};
export const codexTagStyle = (label) => {
  const h = hueOf(label);
  return {
    background: `color-mix(in oklab, oklch(58% .13 ${h}) 22%, transparent)`,
    borderColor: `color-mix(in oklab, oklch(62% .13 ${h}) 40%, transparent)`,
    color: `color-mix(in oklab, oklch(74% .14 ${h}) 50%, var(--color-ink-50))`
  };
};

export const cleanCodexTags = (tags) => (Array.isArray(tags) ? tags : [])
  .map(t => String(t).trim().slice(0, MAX_CODEX_TAG_LENGTH))
  .filter(Boolean)
  .filter((t, i, all) => all.findIndex(x => x.toLowerCase() === t.toLowerCase()) === i)
  .slice(0, MAX_CODEX_TAGS);

const FACT_LINE = /^\s*\*\*([^*:]{1,40}):\*\*\s*(.+?)\s*$/;
const QUOTE_LINE = /^\s*>\s?(.*)$/;
const WIKI_LINK = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

// Reads the writing conventions of a codex page's markdown:
//   **Label:** value lines   -> facts
//   > quote at the top       -> epigraph (shown under the title)
//   > quote at the end       -> closing quote
//   [[Other Page]] links     -> related entries
// Everything else is the body, split into paragraphs (blank-line separated).
export function parseCodexContent(content = '') {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  const facts = [];
  const rest = [];
  for (const line of lines) {
    const m = line.match(FACT_LINE);
    if (m) facts.push({ label: m[1].trim(), value: m[2] });
    else rest.push(line);
  }

  // Trim blank lines, then lift leading / trailing quotes
  while (rest.length && !rest[0].trim()) rest.shift();
  while (rest.length && !rest[rest.length - 1].trim()) rest.pop();
  const takeQuote = (fromEnd) => {
    const quote = [];
    while (rest.length) {
      const line = fromEnd ? rest[rest.length - 1] : rest[0];
      const m = line.match(QUOTE_LINE);
      if (!m) break;
      quote[fromEnd ? 'unshift' : 'push'](m[1]);
      fromEnd ? rest.pop() : rest.shift();
    }
    while (rest.length && !(fromEnd ? rest[rest.length - 1] : rest[0]).trim()) fromEnd ? rest.pop() : rest.shift();
    return quote.join(' ').trim();
  };
  const epigraph = takeQuote(false);
  const closing = rest.length ? takeQuote(true) : '';

  const paragraphs = rest.join('\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  const related = [];
  for (const m of String(content).matchAll(WIKI_LINK)) {
    const title = m[1].trim();
    if (title && !related.some(r => r.toLowerCase() === title.toLowerCase())) related.push(title);
  }

  return { facts, epigraph, closing, paragraphs, related };
}
