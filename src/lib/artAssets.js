// Bundled site art served from /public/images. The design-sync build swaps
// this module for inlined copies (.design-sync/stubs/artAssets.js), so keep
// the export names in sync with that file.

export const CREST_IMG = {
  src: '/images/brand/allania-tree-shield-128.webp',
  srcSet: '/images/brand/allania-tree-shield-128.webp 1x, /images/brand/allania-tree-shield-256.webp 2x'
};

export const ROSTER_BANNER_IMG = {
  src: '/images/roster/character-roster-banner-128.webp',
  srcSet: '/images/roster/character-roster-banner-128.webp 1x, /images/roster/character-roster-banner-256.webp 2x'
};

export const EDIT_PEN_IMG = {
  src: '/images/roster/character-edit-pen-128.webp',
  srcSet: '/images/roster/character-edit-pen-128.webp 1x, /images/roster/character-edit-pen-256.webp 2x'
};

// 640x74 and 1024x118 (aspect 8.67)
export const NAME_SCROLL_IMG = {
  src: '/images/roster/character-name-scroll-thin-640.webp',
  srcSet: '/images/roster/character-name-scroll-thin-640.webp 640w, /images/roster/character-name-scroll-thin-1024.webp 1024w'
};

export const FOOTER_BANNER_IMG = {
  src: '/images/footer/world-map-footer-1600.webp',
  srcSet: '/images/footer/world-map-footer-640.webp 640w, /images/footer/world-map-footer-1024.webp 1024w, /images/footer/world-map-footer-1600.webp 1600w'
};

// Default region crest (Breville tower) until regions get their own
export const REGION_CREST_IMG = {
  src: '/images/brand/breville-tower-shield-256.webp'
};

// Codex hero, section banners (640 mobile / 1024 desktop) and medallions
const codexBanner = (id) => ({ mobile: `/images/codex/codex-${id}-banner-640.webp`, desktop: `/images/codex/codex-${id}-banner-1024.webp` });
export const CODEX_ART = {
  hero: { mobile: '/images/codex/codex-banner-640.webp', desktop: '/images/codex/codex-banner-1600.webp' },
  characters: { banner: codexBanner('characters'), medallion: '/images/codex/codex-characters-helm-256.webp' },
  locations: { banner: codexBanner('locations'), medallion: '/images/codex/codex-locations-castle-256.webp' },
  history: { banner: codexBanner('history'), medallion: '/images/codex/codex-history-scroll-256.webp' },
};

// Landing hero (640 / 1024 / 1600) and its swappable SVG icons
const landingIcon = (name) => `/images/landing/${name}.svg`;
export const LANDING_ART = {
  hero: { mobile: '/images/landing/landing-banner-640.webp', tablet: '/images/landing/landing-banner-1024.webp', desktop: '/images/landing/landing-banner-1600.webp' },
  icon: landingIcon,
};
