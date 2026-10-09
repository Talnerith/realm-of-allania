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
const CLAIM = (key) => ({ path: `artifacts/realm-of-allania-v2/public/data/usernames/${key}` });

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
  let profileDoc;
  let batch;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    account = { role: 'user', activeCharId: 'c2', hideWelcome: true };
    profileDoc = null;
    firestore.doc.mockImplementation((_, ...path) => ({ path: path.join('/') }));
    firestore.collection.mockImplementation((_, ...path) => ({ path: path.join('/') }));
    firestore.query.mockImplementation((ref) => ref);
    firestore.serverTimestamp.mockReturnValue('now');
    firestore.onSnapshot.mockImplementation((ref, cb) => {
      if (ref.path === ACCOUNT) cb({ exists: () => true, data: () => account });
      else if (ref.path === PROFILE) cb({ exists: () => !!profileDoc, data: () => profileDoc });
      else cb({ docs: [] });
      return jest.fn();
    });
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    batch = { set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn().mockResolvedValue() };
    firestore.writeBatch.mockReturnValue(batch);
    firestore.setDoc.mockResolvedValue();
    firestore.updateDoc.mockResolvedValue();
    fbAuth.onAuthStateChanged.mockImplementation((auth, cb) => {
      cb({ uid: 'u1', displayName: 'Wanderer', emailVerified: true, email: 'w@example.com', getIdTokenResult: async () => ({ claims: { email_verified: true } }) });
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

  it('reports the role as loaded only once the account arrives', async () => {
    let emitAccount;
    firestore.onSnapshot.mockImplementation((ref, cb) => {
      if (ref.path === ACCOUNT) emitAccount = cb;
      else if (ref.path === PROFILE) cb({ exists: () => false, data: () => null });
      else cb({ docs: [] });
      return jest.fn();
    });
    await renderProvider();
    expect(ctx.roleLoaded).toBe(false);
    // The listener is async, so act must be awaited
    await act(async () => { emitAccount({ exists: () => true, data: () => ({ role: 'moderator' }) }); });
    expect(ctx.roleLoaded).toBe(true);
    expect(ctx.userRole).toBe('moderator');
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

  it('creates a missing public profile from the display name, claiming the name', async () => {
    await renderProvider();
    await waitFor(() => expect(batch.commit).toHaveBeenCalled());
    expect(batch.set).toHaveBeenCalledWith({ path: PROFILE }, { displayName: 'Wanderer', createdAt: 'now' });
    expect(batch.set).toHaveBeenCalledWith(CLAIM('n_wanderer'), { uid: 'u1' });
  });

  it('leaves an existing profile alone', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ displayName: 'Wanderer' }) });
    await renderProvider();
    await act(async () => {});
    expect(batch.set).not.toHaveBeenCalledWith({ path: PROFILE }, expect.anything());
  });

  describe('verification token refresh', () => {
    const signInAs = (user) => {
      fbAuth.onAuthStateChanged.mockImplementation((auth, cb) => { cb(user); return jest.fn(); });
    };
    const player = (fields) => ({
      uid: 'u1', displayName: 'Wanderer', email: 'w@example.com',
      reload: jest.fn(), getIdToken: jest.fn().mockResolvedValue('fresh'), ...fields,
    });

    it('refreshes a stale token for a player verified since it was issued', async () => {
      // On page load the SDK reloads the user but keeps the cached token
      const user = player({ emailVerified: true, getIdTokenResult: jest.fn().mockResolvedValue({ claims: { email_verified: false } }) });
      signInAs(user);
      await renderProvider();
      expect(user.reload).not.toHaveBeenCalled();
      expect(user.getIdToken).toHaveBeenCalledWith(true);
    });

    it('refreshes the token when a reload shows the email was just verified', async () => {
      const user = player({ emailVerified: false, getIdTokenResult: jest.fn().mockResolvedValue({ claims: { email_verified: false } }) });
      user.reload.mockImplementation(async () => { user.emailVerified = true; });
      signInAs(user);
      await renderProvider();
      expect(user.getIdToken).toHaveBeenCalledWith(true);
    });

    it('leaves a current token alone', async () => {
      const user = player({ emailVerified: true, getIdTokenResult: jest.fn().mockResolvedValue({ claims: { email_verified: true } }) });
      signInAs(user);
      await renderProvider();
      expect(user.getIdToken).not.toHaveBeenCalled();
    });

    it('does not refresh for a player who is still unverified', async () => {
      const user = player({ emailVerified: false, getIdTokenResult: jest.fn() });
      signInAs(user);
      await renderProvider();
      expect(user.reload).toHaveBeenCalled();
      expect(user.getIdTokenResult).not.toHaveBeenCalled();
      expect(user.getIdToken).not.toHaveBeenCalled();
    });
  });

  it('signup writes the account and the public profile', async () => {
    fbAuth.onAuthStateChanged.mockImplementation(() => jest.fn());
    const newUser = { uid: 'u9', getIdToken: jest.fn() };
    fbAuth.createUserWithEmailAndPassword.mockResolvedValue({ user: newUser });
    fbAuth.updateProfile.mockResolvedValue();
    fbAuth.sendEmailVerification.mockResolvedValue();
    await renderProvider();
    await act(async () => { await ctx.signup('n@example.com', 'secret123', 'Emberquill'); });
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'artifacts/realm-of-allania-v2/public/data/profiles/u9' },
      { displayName: 'Emberquill', createdAt: 'now' }
    );
    expect(batch.set).toHaveBeenCalledWith(CLAIM('n_emberquill'), { uid: 'u9' });
  });

  it('signup refuses a name another player has, before making the account', async () => {
    fbAuth.onAuthStateChanged.mockImplementation(() => jest.fn());
    firestore.getDoc.mockImplementation(async (ref) => (ref.path.endsWith('/usernames/n_ember quill')
      ? { exists: () => true, data: () => ({ uid: 'someone' }) }
      : { exists: () => false }));
    await renderProvider();
    await expect(ctx.signup('n@example.com', 'secret123', 'Ember  Quill')).rejects.toThrow('already taken');
    expect(fbAuth.createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  describe('updateDisplayName', () => {
    beforeEach(() => {
      auth.currentUser = { uid: 'u1', displayName: 'Wanderer' };
      fbAuth.updateProfile.mockResolvedValue();
    });
    afterEach(() => { delete auth.currentUser; });

    // The profile exists with the old name; the new name is free unless taken
    const profileAndClaims = (takenBy = null) => firestore.getDoc.mockImplementation(async (ref) => {
      if (ref.path === PROFILE) return { exists: () => true, data: () => ({ displayName: 'Wanderer' }) };
      if (takenBy && ref.path.includes('/usernames/')) return { exists: () => true, data: () => ({ uid: takenBy }) };
      return { exists: () => false };
    });

    it('renames the public profile, the Auth profile and the account', async () => {
      await renderProvider();
      profileAndClaims();
      expect(ctx.displayName).toBe('Wanderer');
      await act(async () => { await ctx.updateDisplayName('  Emberquill '); });
      // Claims the new name and releases the old one with the profile change
      expect(batch.update).toHaveBeenCalledWith({ path: PROFILE }, { displayName: 'Emberquill' });
      expect(batch.set).toHaveBeenCalledWith(CLAIM('n_emberquill'), { uid: 'u1' });
      expect(batch.delete).toHaveBeenCalledWith(CLAIM('n_wanderer'));
      expect(fbAuth.updateProfile).toHaveBeenCalledWith(auth.currentUser, { displayName: 'Emberquill' });
      expect(firestore.updateDoc).toHaveBeenCalledWith({ path: ACCOUNT }, { username: 'Emberquill' });
      expect(ctx.displayName).toBe('Emberquill');
    });

    it('refuses a name another player has', async () => {
      await renderProvider();
      profileAndClaims('someone');
      batch.commit.mockClear();
      await expect(ctx.updateDisplayName('Emberquill')).rejects.toThrow('already taken');
      expect(batch.commit).not.toHaveBeenCalled();
      expect(ctx.displayName).toBe('Wanderer');
    });

    it('changing only the capitals keeps the same claim', async () => {
      await renderProvider();
      profileAndClaims('u1');
      batch.set.mockClear();
      await act(async () => { await ctx.updateDisplayName('WANDERER'); });
      expect(batch.update).toHaveBeenCalledWith({ path: PROFILE }, { displayName: 'WANDERER' });
      expect(batch.set).not.toHaveBeenCalled();
      expect(batch.delete).not.toHaveBeenCalled();
    });

    it('creates the profile when it is missing', async () => {
      await renderProvider();
      batch.set.mockClear();
      await act(async () => { await ctx.updateDisplayName('Emberquill'); });
      expect(batch.set).toHaveBeenCalledWith({ path: PROFILE }, { displayName: 'Emberquill', createdAt: 'now' });
      expect(batch.set).toHaveBeenCalledWith(CLAIM('n_emberquill'), { uid: 'u1' });
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
      profileAndClaims();
      const err = new Error('Missing or insufficient permissions.'); err.code = 'permission-denied';
      batch.commit.mockRejectedValueOnce(err);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(ctx.updateDisplayName('Emberquill')).rejects.toThrow('Could not save your name');
      expect(fbAuth.updateProfile).not.toHaveBeenCalled();
      expect(ctx.displayName).toBe('Wanderer');
      console.error.mockRestore();
    });
  });

  describe('author picture', () => {
    const PIC = 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg';
    afterEach(() => { delete auth.currentUser; });

    it('loads the picture from the public profile', async () => {
      profileDoc = { displayName: 'Wanderer', avatarUrl: PIC, avatarPosition: '50% 20%' };
      await renderProvider();
      expect(ctx.avatar).toEqual({ url: PIC, position: '50% 20%' });
    });

    it('has no picture by default', async () => {
      await renderProvider();
      expect(ctx.avatar).toEqual({ url: '', position: 'center' });
    });

    it('saves and removes the picture', async () => {
      auth.currentUser = { uid: 'u1' };
      await renderProvider();
      await act(async () => { await ctx.updateAvatar(PIC, '40% 40%'); });
      expect(firestore.updateDoc).toHaveBeenCalledWith({ path: PROFILE }, { avatarUrl: PIC, avatarPosition: '40% 40%' });
      expect(ctx.avatar).toEqual({ url: PIC, position: '40% 40%' });
      await act(async () => { await ctx.updateAvatar(''); });
      expect(firestore.updateDoc).toHaveBeenLastCalledWith({ path: PROFILE }, { avatarUrl: '', avatarPosition: 'center' });
      expect(ctx.avatar.url).toBe('');
    });

    it('reports a failed save and keeps the old picture', async () => {
      auth.currentUser = { uid: 'u1' };
      await renderProvider();
      firestore.updateDoc.mockRejectedValueOnce(new Error('denied'));
      jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(ctx.updateAvatar(PIC)).rejects.toThrow('Could not save your picture');
      expect(ctx.avatar.url).toBe('');
      console.error.mockRestore();
    });
  });
});
