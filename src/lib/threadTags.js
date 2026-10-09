// Thread tags: up to 3 per thread from this list (firestore.rules isValidTags
// holds the same list). Each has a hue for its colour-coded chip.
export const TAG_HUE = {
  Roleplay: 255, Adventure: 65, Lore: 200, Investigation: 285, Discussion: 330,
  Open: 230, Ongoing: 150, Politics: 25, Trade: 110
};
export const THREAD_TAGS = Object.keys(TAG_HUE);
export const MAX_TAGS = 3;

// Chip colours mixed toward the ink ramp, so they read in both themes
export const tagStyle = (label) => {
  const h = TAG_HUE[label] ?? 60;
  return {
    background: `color-mix(in oklab, oklch(58% .13 ${h}) 22%, transparent)`,
    borderColor: `color-mix(in oklab, oklch(62% .13 ${h}) 40%, transparent)`,
    color: `color-mix(in oklab, oklch(74% .14 ${h}) 50%, var(--color-ink-50))`
  };
};

export const validTags = (tags) => (Array.isArray(tags) ? tags.filter(t => TAG_HUE[t] !== undefined).slice(0, MAX_TAGS) : []);
