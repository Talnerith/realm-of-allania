// Design-sync stand-in for '@/context/GameContext'. The app's GameProvider
// signs in with Firebase Auth and streams the player's data; in Claude Design
// there is no backend, so AllaniaProvider supplies a signed-in sample player
// (or a signed-out visitor) and the sample world through the same useGame()
// contract the components already read. Theme and accent come from the app's
// real ThemeProvider.
import { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { SAMPLE_USER, SAMPLE_CHARACTERS, SAMPLE_DATA, SAMPLE_READ_RECEIPTS } from '../sample-data.js';
import { setStore } from '../store.js';

export { useTheme } from '@/context/ThemeContext';

const noop = async () => {};
const ACTIONS = { signup: noop, login: noop, logout: noop, resendVerification: noop, resetPassword: noop, updateDisplayName: noop };
const SIGNED_OUT = {
  user: null, userRole: 'user', loading: false, characters: [], activeCharId: null,
  setActiveCharId: () => {}, hideWelcome: null, setHideWelcome: () => {}, displayName: null, readReceipts: {}, ...ACTIONS
};

const GameContext = createContext(null);

/**
 * Root wrapper for every Realm of Allania component: the theme (dark/light,
 * accent palette), the signed-in player, their characters, role and read
 * receipts (what the app's providers do), plus the sample world the
 * components read.
 * @param theme     'dark' | 'light' | 'system' (default: the parent provider's, else the saved choice, else system)
 * @param accent    'ember' (default) | 'brass' | 'verdigris'
 * @param signedIn  false renders the guest experience
 * @param role      'user' | 'trusted' | 'moderator' | 'admin' (mod tools appear for moderator/admin)
 * @param data      replace the sample world ({ "<collection path>": { <docId>: {...} } }; one per page)
 *                  Loading states: use the id "__pending__" (e.g. thread={{ id: '__pending__' }})
 */
export function AllaniaProvider({
  children, theme, accent, signedIn = true, role = 'user', user, characters, activeCharId, readReceipts, data
}) {
  const roster = characters ?? SAMPLE_CHARACTERS;
  const [active, setActive] = useState(activeCharId ?? roster[0]?.id ?? null);
  // Swap the sample world before children subscribe (idempotent)
  useMemo(() => setStore(data ?? SAMPLE_DATA), [data]);

  const value = useMemo(() => (signedIn ? {
    ...ACTIONS,
    user: user ?? SAMPLE_USER,
    displayName: (user ?? SAMPLE_USER).displayName ?? null,
    userRole: role,
    loading: false,
    characters: roster,
    activeCharId: active,
    setActiveCharId: setActive,
    hideWelcome: false,
    setHideWelcome: () => {},
    readReceipts: readReceipts ?? SAMPLE_READ_RECEIPTS
  } : SIGNED_OUT), [signedIn, user, role, roster, active, readReceipts]);

  // scope="local": themes apply to this subtree, so several providers with
  // different themes can share a page
  return (
    <ThemeProvider theme={theme} accent={accent} scope="local">
      <GameContext.Provider value={value}>{children}</GameContext.Provider>
    </ThemeProvider>
  );
}

export const GameProvider = AllaniaProvider;

// Outside a provider, components see a signed-out visitor instead of crashing
export const useGame = () => useContext(GameContext) ?? SIGNED_OUT;
