// Design-sync stand-in for '@/context/GameContext'. The app's GameProvider
// signs in with Firebase Auth and streams the player's data; in Claude Design
// there is no backend, so AllaniaProvider supplies a signed-in sample player
// (or a signed-out visitor) and the sample world through the same useGame()
// contract the components already read.
import { createContext, useContext, useMemo, useState } from 'react';
import { SAMPLE_USER, SAMPLE_CHARACTERS, SAMPLE_DATA, SAMPLE_READ_RECEIPTS } from '../sample-data.js';
import { setStore } from '../store.js';

const noop = async () => {};
const ACTIONS = { signup: noop, login: noop, logout: noop, resendVerification: noop, resetPassword: noop };
const SIGNED_OUT = {
  user: null, userRole: 'user', loading: false, characters: [], activeCharId: null,
  setActiveCharId: () => {}, readReceipts: {}, ...ACTIONS
};

const GameContext = createContext(null);

/**
 * Root wrapper for every Realm of Allania component: provides the signed-in
 * player, their characters, role and read receipts (what the app's
 * GameProvider does) plus the sample world the components read.
 * @param signedIn  false renders the guest experience
 * @param role      'user' | 'trusted' | 'moderator' | 'admin' (mod tools appear for moderator/admin)
 * @param data      replace the sample world ({ "<collection path>": { <docId>: {...} } })
 */
export function AllaniaProvider({
  children, signedIn = true, role = 'user', user, characters, activeCharId, readReceipts, data
}) {
  const roster = characters ?? SAMPLE_CHARACTERS;
  const [active, setActive] = useState(activeCharId ?? roster[0]?.id ?? null);
  // Swap the sample world before children subscribe (idempotent)
  useMemo(() => setStore(data ?? SAMPLE_DATA), [data]);

  const value = useMemo(() => (signedIn ? {
    ...ACTIONS,
    user: user ?? SAMPLE_USER,
    userRole: role,
    loading: false,
    characters: roster,
    activeCharId: active,
    setActiveCharId: setActive,
    readReceipts: readReceipts ?? SAMPLE_READ_RECEIPTS
  } : SIGNED_OUT), [signedIn, user, role, roster, active, readReceipts]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export const GameProvider = AllaniaProvider;

// Outside a provider, components see a signed-out visitor instead of crashing
export const useGame = () => useContext(GameContext) ?? SIGNED_OUT;
