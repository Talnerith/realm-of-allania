// Design-sync stand-in for '@/lib/constants': the real values, except the map
// image, which the app serves from /public and is inlined here (downscaled)
// because Claude Design has no /public folder.
export * from '../../src/lib/constants.js';
import mapPreview from '../assets/map-preview.webp';

export const MAP_IMAGE_URL = mapPreview;
