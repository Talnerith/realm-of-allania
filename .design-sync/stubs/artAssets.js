// Design-sync stand-in for '@/lib/artAssets': Claude Design has no /public
// folder, so one size of each piece of art is inlined (no srcSet).
import crest from '../../public/images/brand/allania-tree-shield-256.webp';
import rosterBanner from '../../public/images/roster/character-roster-banner-256.webp';
import editPen from '../../public/images/roster/character-edit-pen-256.webp';
import nameScroll from '../../public/images/roster/character-name-scroll-640.webp';
import footerBanner from '../../public/images/footer/world-map-footer-1024.webp';

export const CREST_IMG = { src: crest };
export const ROSTER_BANNER_IMG = { src: rosterBanner };
export const EDIT_PEN_IMG = { src: editPen };
export const NAME_SCROLL_IMG = { src: nameScroll };
export const FOOTER_BANNER_IMG = { src: footerBanner };
