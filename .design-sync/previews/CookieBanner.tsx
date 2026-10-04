import { CookieBanner } from 'realm-of-aethelraed';
import { Frame } from '../preview-helpers';

// The banner slides in after a 1s delay in the app; skip the wait for the card.
const realSetTimeout = window.setTimeout;
window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) =>
  realSetTimeout(fn, ms === 1000 ? 0 : ms, ...args)) as typeof window.setTimeout;
try { localStorage.removeItem('cookies-accepted'); } catch { /* storage blocked */ }

export const Visible = () => <Frame height={260}><CookieBanner /></Frame>;
