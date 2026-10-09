"use client";
import { useState } from 'react';
import { LocateFixed, BookOpen, ArrowRight, ChevronRight } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { useSiteStats, formatStat } from '@/lib/siteStats';
import { LANDING_ART } from '@/lib/artAssets';

const SKIP_KEY = 'skipLanding';

const readSkip = () => {
  try { return typeof window !== 'undefined' && localStorage.getItem(SKIP_KEY) === 'true'; } catch { return false; }
};

// Gold rule with a centre diamond (fixed colours: it sits on the hero image)
const HeroRule = ({ className }) => (
  <svg viewBox="0 0 300 10" aria-hidden="true" className={`h-2.5 ${className}`}>
    <path d="M0 5h140M160 5h140" stroke="var(--a-700)" strokeWidth="1" />
    <path d="M150 1l4 4-4 4-4-4z" fill="rgb(8 10 15)" stroke="var(--a-400)" strokeWidth="1" />
  </svg>
);

const Corners = () => ['top-[5px] left-[5px] border-t border-l', 'top-[5px] right-[5px] border-t border-r', 'bottom-[5px] left-[5px] border-b border-l', 'bottom-[5px] right-[5px] border-b border-r']
  .map(c => <span key={c} aria-hidden="true" className={`absolute w-3.5 h-3.5 border-gold-700 ${c}`} />);

const FEATURES = [
  { icon: 'feature-write', title: 'Write Together', body: 'Create characters, shape stories, and build a shared world with a passionate and welcoming community.', to: 'map' },
  { icon: 'feature-explore', title: 'Explore a Living World', body: 'Discover regions, factions, gods and history through the Codex and World Map, all built by the community.', to: 'codex' },
  { icon: 'feature-community', title: 'Join a Thriving Community', body: 'Collaborate through open threads, roleplay, worldbuilding, and more. New writers and seasoned storytellers are always welcome.', to: 'map' },
];

const STEPS = [
  { icon: 'step-character', title: 'Create Your Character', body: 'Give them a name, a race and a story in the Character Roster, then add them to the Codex.', to: 'map' },
  { icon: 'step-explore', title: 'Explore Allania', body: 'Browse the World Map and Codex to learn about the setting.', to: 'codex' },
  { icon: 'step-thread', title: 'Create or Join a Thread', body: 'Write your own story or jump into an existing one.', to: 'map' },
  { icon: 'step-build', title: 'Build the Future', body: 'Shape the world alongside fellow creators.', to: 'map' },
];

const STAT_ROWS = [
  ['stat-members', 'members', 'Members'],
  ['stat-posts', 'posts', 'Posts'],
  ['stat-characters', 'characters', 'Characters'],
  ['stat-regions', 'regions', 'Regions'],
];

// The welcome page: shown first after sign-in unless the player ticked
// "Don't show this again" (saved on their account; guests on this device)
export default function LandingPage({ onEnter, onNavigate }) {
  const { user, setHideWelcome, displayName } = useGame() || {};
  const welcomeName = displayName || user?.displayName;
  const stats = useSiteStats();
  const [skipFuture, setSkipFuture] = useState(readSkip);
  const go = (view) => (view === 'map' ? onEnter(skipFuture) : (onNavigate ? onNavigate(view) : onEnter(skipFuture)));

  const toggleSkip = (checked) => {
    setSkipFuture(checked);
    try {
      if (checked) localStorage.setItem(SKIP_KEY, 'true');
      else localStorage.removeItem(SKIP_KEY);
    } catch { /* storage blocked: the account setting still applies */ }
    if (user) setHideWelcome?.(checked);
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-ink-950 text-ink-200">
      {/* Hero */}
      <section className="relative overflow-hidden min-h-[clamp(34rem,40vw+14rem,44rem)]">
        <picture>
          <source media="(min-width: 1200px)" srcSet={LANDING_ART.hero.desktop} />
          <source media="(min-width: 700px)" srcSet={LANDING_ART.hero.tablet} />
          <img src={LANDING_ART.hero.mobile} alt="" className="absolute inset-0 w-full h-full object-cover object-[70%_40%]" />
        </picture>
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgb(8_10_15/.9)_0%,rgb(8_10_15/.7)_34%,rgb(8_10_15/.1)_68%),linear-gradient(0deg,rgb(8_10_15/.95)_0%,rgb(8_10_15/.3)_30%,transparent_55%)]" />
        <div className="absolute inset-0 md:hidden pointer-events-none bg-[rgb(8_10_15/.45)]" />
        <div className="relative flex flex-col gap-5 px-5 md:px-12 pb-12 max-w-[46rem] pt-[clamp(3rem,4vw+1.5rem,5rem)]">
          <div className="flex flex-col gap-2">
            <span className="uppercase text-xs md:text-sm tracking-[.22em] text-(color:--a-400)">A living world, written together</span>
            <HeroRule className="w-[min(100%,22rem)]" />
          </div>
          <h1 className="font-serif font-bold leading-none text-[clamp(2.75rem,5vw+1rem,5rem)] text-(color:--a-100) [text-shadow:0_2px_24px_rgb(0_0_0/.45)]">Realm of Allania</h1>
          <span className="font-serif uppercase leading-none text-[clamp(1.25rem,1.6vw+.6rem,2.25rem)] tracking-[.4em] text-(color:--a-400)">Chronicles</span>
          <HeroRule className="w-[min(100%,18rem)]" />
          <p className="text-base md:text-lg leading-relaxed text-white/90 text-pretty max-w-[32rem]">
            A collaborative world of imagination, where stories, characters, and cultures are built by a community of writers, for writers. Explore. Create. Contribute. Belong.
          </p>
          {welcomeName && <p className="font-serif italic text-xl text-(color:--a-200)">Welcome back, {welcomeName}.</p>}
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <button type="button" onClick={() => go('map')}
              className="flex items-center gap-3 rounded px-6 py-3 text-base font-bold text-white bg-(color:--a-600) hover:bg-(color:--a-500) shadow-[0_8px_24px_rgb(0_0_0/.35)] transition-colors">
              <LocateFixed className="w-[18px] h-[18px]" strokeWidth={1.8} aria-hidden="true" />
              <span>Enter the World Map</span>
              <ArrowRight className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go('codex')}
              className="flex items-center gap-3 rounded px-6 py-3 text-base text-white bg-[rgb(8_10_15/.6)] border border-(color:--a-700) hover:border-(color:--a-400) hover:text-(color:--a-200) transition-colors">
              <BookOpen className="w-[18px] h-[18px]" strokeWidth={1.8} aria-hidden="true" />
              <span>Explore the Codex</span>
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer self-start text-sm text-white/80">
            <input type="checkbox" checked={skipFuture} onChange={(e) => toggleSkip(e.target.checked)} className="w-4 h-4 accent-(color:--a-500)" />
            <span>Don&apos;t show this again</span>
          </label>
          {skipFuture && (
            <p className="-mt-2 text-xs text-white/70">
              You&apos;ll go straight to the World Map{user ? ' after signing in. Turn it back on from your account menu.' : ' on this device.'}
            </p>
          )}
          {stats && (
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 mt-3">
              {STAT_ROWS.map(([icon, key, label]) => (
                <div key={key} className="flex items-center gap-3">
                  <img src={LANDING_ART.icon(icon)} alt="" className="shrink-0 w-11 h-11 block" />
                  <div className="flex flex-col">
                    <dt className="sr-only">{label}</dt>
                    <dd className="font-serif text-xl leading-none text-(color:--a-300)">{formatStat(stats[key])}</dd>
                    <dd aria-hidden="true" className="text-xs mt-1 text-white/80">{label}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <div className="relative px-4 md:px-12 pb-24 flex flex-col gap-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <button key={f.title} type="button" onClick={() => go(f.to)}
              className="relative flex items-center gap-5 rounded-[6px] bg-(color:--card-bg) border border-gold-900/50 hover:border-gold-700 shadow-(--card-shadow) p-5 md:p-6 text-left transition-colors">
              <Corners />
              <img src={LANDING_ART.icon(f.icon)} alt="" className="shrink-0 w-20 h-20 block" />
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="font-serif text-2xl leading-tight text-ink-50">{f.title}</span>
                <span className="text-sm text-ink-300 text-pretty">{f.body}</span>
              </span>
              <ChevronRight className="w-[18px] h-[18px] shrink-0 text-gold-500" aria-hidden="true" />
            </button>
          ))}
        </div>

        <section className="flex flex-col gap-10" aria-labelledby="how-it-works">
          <div className="flex items-center justify-center gap-4">
            <svg viewBox="0 0 120 10" aria-hidden="true" className="w-30 h-2.5"><path d="M0 5h108" stroke="var(--color-gold-700)" strokeWidth="1" /><path d="M114 1l4 4-4 4-4-4z" fill="none" stroke="var(--color-gold-500)" strokeWidth="1" /></svg>
            <h2 id="how-it-works" className="text-sm uppercase text-gold-500 tracking-[.3em]">How it works</h2>
            <svg viewBox="0 0 120 10" aria-hidden="true" className="w-30 h-2.5"><path d="M12 5h108" stroke="var(--color-gold-700)" strokeWidth="1" /><path d="M6 1l4 4-4 4-4-4z" fill="none" stroke="var(--color-gold-500)" strokeWidth="1" /></svg>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mx-auto w-full max-w-6xl">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <button type="button" onClick={() => go(step.to)} className="w-full flex flex-col gap-3 rounded-lg p-3 text-left hover:bg-ink-900/60 transition-colors">
                  <span className="flex items-center gap-3">
                    <img src={LANDING_ART.icon(`step-number-${i + 1}`)} alt={`Step ${i + 1}`} className="shrink-0 w-11 h-11 block" />
                    <img src={LANDING_ART.icon(step.icon)} alt="" className="shrink-0 w-14 h-14 block" />
                  </span>
                  <span className="font-serif text-2xl leading-tight text-ink-50">{step.title}</span>
                  <span className="text-base text-ink-300 text-pretty">{step.body}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        {/* Tutorial video (kept from the earlier landing page) */}
        <section className="relative rounded-[6px] bg-(color:--card-bg) border border-gold-900/50 shadow-(--card-shadow) p-5 md:p-8 grid md:grid-cols-2 gap-8 items-center max-w-6xl mx-auto w-full" aria-labelledby="see-it">
          <Corners />
          <div className="flex flex-col gap-3">
            <h2 id="see-it" className="font-serif text-3xl text-gold-100">See it in action</h2>
            <p className="text-ink-300 leading-relaxed">
              Play-by-post roleplay is collaborative storytelling at your own pace: pick a region on the map, write as your character, and others reply when inspiration strikes.
            </p>
          </div>
          <div className="rounded-lg overflow-hidden border border-ink-700 bg-ink-900 aspect-video">
            <video className="w-full h-full object-cover" controls muted playsInline preload="none" poster="/images/tutorial-demo-poster.jpg">
              <source src="/images/tutorial-demo.webm" type="video/webm" />
              <source src="/images/tutorial-demo.mp4" type="video/mp4" />
            </video>
          </div>
        </section>
      </div>
    </div>
  );
}
