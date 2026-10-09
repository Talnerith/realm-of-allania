// Design-sync stand-in for '@/lib/artAssets': Claude Design has no /public
// folder, so one size of each piece of art is inlined (no srcSet).
import crest from '../../public/images/brand/allania-tree-shield-256.webp';
import rosterBanner from '../../public/images/roster/character-roster-banner-256.webp';
import editPen from '../../public/images/roster/character-edit-pen-256.webp';
import nameScroll from '../../public/images/roster/character-name-scroll-640.webp';
import footerBanner from '../../public/images/footer/world-map-footer-1024.webp';
import regionCrest from '../../public/images/brand/breville-tower-shield-256.webp';
import landingHero from '../../public/images/landing/landing-banner-640.webp';
import landing_feature_community from '../../public/images/landing/feature-community.svg';
import landing_feature_explore from '../../public/images/landing/feature-explore.svg';
import landing_feature_write from '../../public/images/landing/feature-write.svg';
import landing_stat_characters from '../../public/images/landing/stat-characters.svg';
import landing_stat_members from '../../public/images/landing/stat-members.svg';
import landing_stat_posts from '../../public/images/landing/stat-posts.svg';
import landing_stat_regions from '../../public/images/landing/stat-regions.svg';
import landing_step_build from '../../public/images/landing/step-build.svg';
import landing_step_character from '../../public/images/landing/step-character.svg';
import landing_step_explore from '../../public/images/landing/step-explore.svg';
import landing_step_number_1 from '../../public/images/landing/step-number-1.svg';
import landing_step_number_2 from '../../public/images/landing/step-number-2.svg';
import landing_step_number_3 from '../../public/images/landing/step-number-3.svg';
import landing_step_number_4 from '../../public/images/landing/step-number-4.svg';
import landing_step_thread from '../../public/images/landing/step-thread.svg';
import codexHero from '../../public/images/codex/codex-banner-640.webp';
import charactersBanner from '../../public/images/codex/codex-characters-banner-640.webp';
import locationsBanner from '../../public/images/codex/codex-locations-banner-640.webp';
import historyBanner from '../../public/images/codex/codex-history-banner-640.webp';
import charactersMedallion from '../../public/images/codex/codex-characters-helm-256.webp';
import locationsMedallion from '../../public/images/codex/codex-locations-castle-256.webp';
import historyMedallion from '../../public/images/codex/codex-history-scroll-256.webp';

export const CREST_IMG = { src: crest };
export const ROSTER_BANNER_IMG = { src: rosterBanner };
export const EDIT_PEN_IMG = { src: editPen };
export const NAME_SCROLL_IMG = { src: nameScroll };
export const FOOTER_BANNER_IMG = { src: footerBanner };
export const REGION_CREST_IMG = { src: regionCrest };
const one = (src) => ({ mobile: src, desktop: src });
export const CODEX_ART = {
  hero: one(codexHero),
  characters: { banner: one(charactersBanner), medallion: charactersMedallion },
  locations: { banner: one(locationsBanner), medallion: locationsMedallion },
  history: { banner: one(historyBanner), medallion: historyMedallion },
};
const LANDING_ICONS = { 'feature-community': landing_feature_community, 'feature-explore': landing_feature_explore, 'feature-write': landing_feature_write, 'stat-characters': landing_stat_characters, 'stat-members': landing_stat_members, 'stat-posts': landing_stat_posts, 'stat-regions': landing_stat_regions, 'step-build': landing_step_build, 'step-character': landing_step_character, 'step-explore': landing_step_explore, 'step-number-1': landing_step_number_1, 'step-number-2': landing_step_number_2, 'step-number-3': landing_step_number_3, 'step-number-4': landing_step_number_4, 'step-thread': landing_step_thread };
export const LANDING_ART = { hero: { mobile: landingHero, tablet: landingHero, desktop: landingHero }, icon: (name) => LANDING_ICONS[name] };
