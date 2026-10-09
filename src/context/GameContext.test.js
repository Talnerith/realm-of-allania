import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '@/context/GameContext';
import * as firestore from 'firebase/firestore';
import * as fbAuth from 'firebase/auth';
import { auth } from '@/lib/firebase';

jest.mock('@/lib/firebase', () => ({ auth: {}, db: {} }));
jest.mock('firebase/auth');
jest.mock('firebase/firestore');

const ACCOUNT = 'artifacts/realm-of-allania-v2/users/u1/settings/account';
const PROFILE = 'artifacts/realm-of-allania-v2/public/data/profiles/u1';

// Latest context value, handed out through a callback so tests can call its actions
let ctx;
const capture = (value) => { ctx = value; };
const Probe = () => {
  const game = useGame();
  capture(game);
  return <div>{game.loading ? 'loading' : `active:${game.activeCharId} hide:${String(game.hideWelcome)}`}</div>;
};

describe('GameContext', () => {
  let account;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    account = { role: 'user', activeCharId: 'c2', hideWelcome: true };
    firestore.doc.mockImplementation((_, ...path) => ({ path: path.join('/') }));
    firestore.collection.mockImplementation((_, ...path) => ({ path: path.join('/') }));
    firestore.query.mockImplementation((ref) => ref);
    firestore.serverTimestamp.mockReturnValue('now');
    firestore.onSnapshot.mockImplementation((ref, cb) => {
      if (ref.path === ACCOUNT) cb({ exists: () => true, data: () => account });
      else cb({ docs: [] });
      return jest.fn();
    });
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    firestore.setDoc.mockResolvedValue();
    firestore.updateDoc.mockResolvedValue();
    fbAuth.onAuthStateChanged.mockImplementation((auth, cb) => {
      cb({ uid: 'u1', displayName: 'Wanderer', emailVerified: true, email: 'w@example.com' });
      return jest.fn();
    });
  });

  afterEach(() => jest.useRealTimers());

  const renderProvider = async () => {
    await act(async () => { render(<GameProvider><Probe /></GameProvider>); });
  };

  it('loads the active character and the welcome choice from the account', async () => {
    await renderProvider();
    expect(screen.getByText('active:c2 hide:true')).toBeInTheDocument();
  });

  it('saves the active character on the account', async () => {
    await renderProvider();
    act(() => ctx.setActiveCharId('c7'));
    expect(screen.getByText('active:c7 hide:true')).toBeInTheDocument();
    expect(firestore.updateDoc).toHaveBeenCalledWith({ path: ACCOUNT }, { activeCharId: 'c7' });
  });

  it('saves the welcome choice on the account', async () => {
    account = { role: 'user' };
    await renderProvider();
    expect(screen.getByText('active:null hide:false')).toBeInTheDocument();
    act(() => ctx.setHideWelcome(true));
    expect(firestore.updateDoc).toHaveBeenCalledWith({ path: ACCOUNT }, { hideWelcome: true });
  });

  it('creates a missing public profile from the display name', async () => {
    await renderProvider();
    await waitFor(() => expect(firestore.setDoc).toHaveBeenCalledWith({ path: PROFILE }, { displayName: 'Wanderer', createdAt: 'now' }));
  });

  it('leaves an existing profile alone', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ displayName: 'Wanderer' }) });
    await renderProvider();
    await act(async () => {});
    expect(firestore.setDoc).not.toHaveBeenCalledWith({ path: PROFILE }, expect.anything());
  });

  it('signup writes the account and the public profile', async () => {
    fbAuth.onAuthStateChanged.mockImplementation(() => jest.fn());
    const newUser = { uid: 'u9', getIdToken: jest.fn() };
    fbAuth.createUserWithEmailAndPassword.mockResolvedValue({ user: newUser });
    fbAuth.updateProfile.mockResolvedValue();
    fbAuth.sendEmailVerification.mockResolvedValue();
    await renderProvider();
    await act(async () => { await ctx.signup('n@example.com', 'secret123', 'Emberquill'); });
    expect(firestore.setDoc).toHaveBeenCalledWith(
      { path: 'artifacts/realm-of-allania-v2/public/data/profiles/u9' },
      { displayName: 'Emberquill', createdAt: 'now' }
    );
  });

  describe('updateDisplayName', () => {
    beforeEach(() => {
      auth.currentUser = { uid: 'u1', displayName: 'Wanderer' };
      fbAuth.updateProfile.mockResolvedValue();
    });
    afterEach(() => { delete auth.currentUser; });

    it('renames the public profile, the Auth profile and the account', async () => {
      await renderProvider();
      firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ displayName: 'Wanderer' }) });
      expect(ctx.displayName).toBe('Wanderer');
      await act(async () => { await ctx.updateDisplayName('  Emberquill '); });
      expect(firestore.updateDoc).toHaveBeenCalledWith({ path: PROFILE }, { displayName: 'Emberquill' });
      expect(fbAuth.updateProfile).toHaveBeenCalledWith(auth.currentUser, { displayName: 'Emberquill' });
      expect(firestore.updateDoc).toHaveBeenCalledWith({ path: ACCOUNT }, { username: 'Emberquill' });
      expect(ctx.displayName).toBe('Emberquill');
    });

    it('creates the profile when it is missing', async () => {
      await renderProvider();
      firestore.setDoc.mockClear();
      await act(async () => { await ctx.updateDisplayName('Emberquill'); });
      expect(firestore.setDoc).toHaveBeenCalledWith({ path: PROFILE }, { displayName: 'Emberquill', createdAt: 'now' });
    });

    it('rejects invalid names without writing', async () => {
      await renderProvider();
      firestore.updateDoc.mockClear();
      await expect(ctx.updateDisplayName('J')).rejects.toThrow('at least 2 characters');
      await expect(ctx.updateDisplayName('Official Moderator')).rejects.toThrow('site staff');
      expect(firestore.updateDoc).not.toHaveBeenCalled();
      expect(fbAuth.updateProfile).not.toHaveBeenCalled();
      expect(ctx.displayName).toBe('Wanderer');
    });

    it('reports a failed save and keeps the old name', async () => {
      await renderProvider();
      firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
      const err = new Error('Missing or insufficient permissions.'); err.code = 'permission-denied';
      firestore.updateDoc.mockRejectedValueOnce(err);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(ctx.updateDisplayName('Emberquill')).rejects.toThrow('Could not save your name');
      expect(fbAuth.updateProfile).not.toHaveBeenCalled();
      expect(ctx.displayName).toBe('Wanderer');
      console.error.mockRestore();
    });
  });
});
