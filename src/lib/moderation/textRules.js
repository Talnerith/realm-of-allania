import { FORBIDDEN_KEYWORDS } from './forbiddenKeywords';

// Logic-based checks for text that isn't AI-moderated (chat, character
// profiles, display names). The same patterns are enforced in firestore.rules
// (hasForbiddenText / isReservedName); textRules.test.js fails if they drift.

// Short keywords only match as whole words, so "kys" doesn't hit "Alkyshire"
const WHOLE_WORD_MAX_LENGTH = 3;

// Words that would make a name look like site staff
export const RESERVED_NAME_WORDS = [
  'admin', 'administrator', 'moderator', 'mod', 'mods', 'staff', 'official',
  'system', 'support', 'gm', 'gamemaster', 'game master', 'owner', 'developer', 'dev'
];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWords = (words) => `(^|[^a-z0-9])(${words.map(escapeRegex).join('|')})([^a-z0-9]|$)`;

// Regex bodies (full-match, lowercase input) in a syntax both RE2 (rules) and
// JavaScript accept
export function buildForbiddenPattern(keywords = FORBIDDEN_KEYWORDS) {
  const lower = keywords.map(k => k.toLowerCase());
  const substrings = lower.filter(k => k.length > WHOLE_WORD_MAX_LENGTH).map(escapeRegex);
  const words = lower.filter(k => k.length <= WHOLE_WORD_MAX_LENGTH);
  const parts = [...substrings, ...(words.length ? [wholeWords(words)] : [])];
  return `[\\s\\S]*(${parts.join('|')})[\\s\\S]*`;
}

export function buildReservedNamePattern(words = RESERVED_NAME_WORDS) {
  return `[\\s\\S]*${wholeWords(words)}[\\s\\S]*`;
}

const FORBIDDEN_RE = new RegExp(`^(?:${buildForbiddenPattern()})$`);
const RESERVED_RE = new RegExp(`^(?:${buildReservedNamePattern()})$`);

export function containsForbiddenText(text) {
  return typeof text === 'string' && FORBIDDEN_RE.test(text.toLowerCase());
}

export function isReservedName(name) {
  return typeof name === 'string' && RESERVED_RE.test(name.toLowerCase());
}

// User-facing reason a name can't be used, or null if it's fine
export function nameProblem(name, { allowReserved = false } = {}) {
  if (containsForbiddenText(name)) return 'That name contains a blocked word.';
  if (!allowReserved && isReservedName(name)) return 'Names can\'t suggest site staff (admin, moderator, official...).';
  return null;
}
