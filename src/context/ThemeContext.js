'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ACCENTS, THEMES, THEME_STORAGE_KEY } from '@/lib/theme';

// Theme preference (dark / light / follow the system) and accent palette.
// Applied as data-theme / data-accent attributes, which globals.css maps onto
// the ink/gold color tokens. The app applies them to <html>; a provider with
// scope="local" applies them to its own wrapper (several themes on one page).

const TRANSITION_MS = 350;

const ThemeContext = createContext(null);

const readStored = () => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(value) ? value : null;
  } catch {
    return null; // storage blocked
  }
};

const systemTheme = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

/**
 * @param theme   'dark' | 'light' | 'system'. When given, it is used instead of the saved choice
 *                (until setTheme is called); otherwise the saved choice, else 'system'.
 * @param accent  'gold' (default) | 'ember' | 'brass' | 'verdigris'
 *                Nested providers without theme/accent inherit them from the parent provider.
 * @param scope   'document' (default) sets the attributes on <html>; 'local' on a wrapper
 *                element (several themes on one page). Either way the choice is saved.
 */
export function ThemeProvider({ children, theme: themeProp, accent, scope = 'document' }) {
  // A nested provider without its own theme/accent follows its parent
  const parent = useContext(ThemeContext);
  const inherits = !themeProp && Boolean(parent);
  const [preference, setPreference] = useState(() => themeProp ?? readStored() ?? 'system');
  const [system, setSystem] = useState(systemTheme);
  const wrapperRef = useRef(null);
  const firstApply = useRef(true);

  // A changed theme prop replaces the current preference (adjusted during render)
  const [lastProp, setLastProp] = useState(themeProp);
  if (themeProp !== lastProp) {
    setLastProp(themeProp);
    if (themeProp) setPreference(themeProp);
  }

  // Follow the OS setting while the preference is 'system'
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!media) return undefined;
    const onChange = () => setSystem(media.matches ? 'light' : 'dark');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // Keep tabs in sync: another tab saved a new choice
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_STORAGE_KEY) setPreference(THEMES.includes(e.newValue) ? e.newValue : 'system');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const effective = inherits ? parent.preference : preference;
  const resolved = effective === 'system' ? system : effective;
  const safeAccent = ACCENTS.includes(accent) ? accent : (parent?.accent ?? 'gold');

  // Apply the attributes; ease colors only when switching (not on first paint)
  useEffect(() => {
    const el = scope === 'document' ? document.documentElement : wrapperRef.current;
    if (!el) return undefined;
    const animate = !firstApply.current;
    firstApply.current = false;
    if (animate) el.setAttribute('data-theming', '');
    el.setAttribute('data-theme', resolved);
    el.setAttribute('data-accent', safeAccent);
    if (!animate) return undefined;
    const t = setTimeout(() => el.removeAttribute('data-theming'), TRANSITION_MS);
    return () => { clearTimeout(t); el.removeAttribute('data-theming'); };
  }, [resolved, safeAccent, scope]);

  const setOwnTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    setPreference(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* storage blocked */ }
  }, []);

  const setTheme = inherits ? parent.setTheme : setOwnTheme;
  const value = useMemo(() => ({ theme: resolved, preference: effective, setTheme, accent: safeAccent }), [resolved, effective, setTheme, safeAccent]);

  return (
    <ThemeContext.Provider value={value}>
      {scope === 'local'
        ? <div ref={wrapperRef} data-theme={resolved} data-accent={safeAccent} className="contents">{children}</div>
        : children}
    </ThemeContext.Provider>
  );
}

const FALLBACK = { theme: 'dark', preference: 'dark', setTheme: () => {}, accent: 'gold' };

/** { theme: 'dark' | 'light' (resolved), preference, setTheme(next), accent } */
export const useTheme = () => useContext(ThemeContext) ?? FALLBACK;
