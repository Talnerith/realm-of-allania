import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import ThreadView from '@/components/Forum/ThreadView';
import { useGame } from '@/context/GameContext';
import * as firestore from 'firebase/firestore';

jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('firebase/firestore');
jest.mock('firebase/storage', () => ({ ref: jest.fn(), deleteObject: jest.fn() }));
jest.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));
jest.mock('@/hooks/useCharacterLocations', () => jest.fn(() => ({ locations: [], activity: [], loading: false, markAllRead: jest.fn() })));
jest.mock('@/hooks/useRegionNames', () => jest.fn(() => () => 'Thornwatch Ridge'));
jest.mock('@/hooks/useMediaQuery', () => jest.fn(() => true));
jest.mock('@/components/ImageUploader', () => function MockUploader() { return null; });
jest.mock('@/components/Forum/PostItem', () => function MockPost({ post, number }) {
  return <article aria-label={`Post ${number}`}>{post.content}</article>;
});
jest.mock('@/components/MarkdownEditor', () => function MockEditor({ value, onChange, onPost, submitLabel }) {
  return (
    <div>
      <textarea aria-label="Reply" value={value} onChange={onChange} />
      <button type="button" onClick={onPost}>{submitLabel}</button>
    </div>
  );
});

const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const makePosts = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, content: `Post body ${i + 1}`, status: 'approved', userId: 'u2', createdAt: ts(1000 + i) }));

describe('ThreadView', () => {
  let posts, threadDoc, batch;
  const props = { thread: { id: 't1', title: 'Smoke over the Ember Road' }, region: { id: 125, name: 'Thornwatch Ridge' }, setView: jest.fn(), onRequireAuth: jest.fn(), onNavigateToRegion: jest.fn(), onOpenThread: jest.fn() };
  const signedIn = (extra = {}) => useGame.mockReturnValue({
    user: { uid: 'u1' }, userRole: 'user',
    characters: [{ id: 'c1', name: 'Aldric Vane', race: 'Human', class: 'Paladin' }], activeCharId: 'c1', ...extra
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    signedIn();
    posts = makePosts(3);
    threadDoc = { title: 'Smoke over the Ember Road', regionId: '125', status: 'approved', postCount: 3, views: 124, createdBy: 'Seraphine Ashdown', createdAt: ts(500), tags: ['Roleplay', 'Ongoing'], excerpt: 'Black smoke above the old waystation.', lastPostBy: 'Lyra Moonwhisper', lastPostAt: ts(Date.now() - 18 * 60000) };
    batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn(() => Promise.resolve()) };
    firestore.writeBatch.mockReturnValue(batch);
    firestore.serverTimestamp.mockReturnValue('now');
    firestore.increment.mockImplementation((n) => ({ increment: n }));
    firestore.collection.mockImplementation((_, ...path) => ({ path: path.join('/') }));
    firestore.doc.mockImplementation((parent, ...path) => ({ path: path.length ? path.join('/') : `${parent.path}/new` }));
    firestore.query.mockImplementation((ref) => ref);
    firestore.setDoc.mockResolvedValue();
    firestore.updateDoc.mockResolvedValue();
    firestore.onSnapshot.mockImplementation((ref, cb) => {
      if (ref.path?.endsWith('threads/t1')) cb({ exists: () => true, id: 't1', data: () => threadDoc });
      else if (ref.path?.includes('region_metadata')) cb({ exists: () => true, data: () => ({ name: 'Thornwatch Ridge' }) });
      else cb({ docs: posts.map(p => ({ id: p.id, data: () => p })) });
      return jest.fn();
    });
  });

  const renderView = async (p = {}) => { await act(async () => { render(<ThreadView {...props} {...p} />); }); };

  it('shows the banner with breadcrumb, title, blurb and thread information', async () => {
    await renderView();
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumbs.getByRole('button', { name: 'World Map' })).toBeInTheDocument();
    expect(crumbs.getByRole('button', { name: 'Thornwatch Ridge' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Smoke over the Ember Road' })).toBeInTheDocument();
    expect(screen.getByText('Black smoke above the old waystation.')).toBeInTheDocument();
    const info = within(screen.getByRole('region', { name: 'Thread information' }));
    expect(info.getByText('Seraphine Ashdown')).toBeInTheDocument();
    expect(info.getByText('124')).toBeInTheDocument();
    expect(info.getByText('Roleplay')).toBeInTheDocument();
    expect(info.getByRole('button', { name: 'Lyra' })).toBeInTheDocument();
  });

  it('breadcrumbs navigate to the map and the region', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: 'World Map' }));
    expect(props.setView).toHaveBeenCalledWith('map');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', { name: 'Thornwatch Ridge' }));
    expect(props.setView).toHaveBeenCalledWith('region');
  });

  it('counts one view per session', async () => {
    await renderView();
    expect(firestore.updateDoc).toHaveBeenCalledWith({ path: 'artifacts/realm-of-allania-v2/public/data/threads/t1' }, { views: { increment: 1 } });
    firestore.updateDoc.mockClear();
    await renderView();
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('shows 8 posts per page with pagination', async () => {
    posts = makePosts(19);
    await renderView();
    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByText('Page 1 of 3 · posts 1–8 of 19')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Thread pages, bottom' })).getByRole('button', { name: 'Page 3' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('article', { name: 'Post 17' })).toBeInTheDocument();
    expect(screen.getByText('Page 3 of 3 · posts 17–19 of 19')).toBeInTheDocument();
  });

  it('a single page needs no pager', async () => {
    await renderView();
    expect(screen.queryByRole('navigation', { name: 'Thread pages, top' })).not.toBeInTheDocument();
  });

  it('opens the reply box and posts a reply as the active character', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Continue the tale as Aldric…' }));
    expect(screen.getByText('Will be post #4')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Reply' }), { target: { value: 'Aldric drew his sword and waited.' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post reply' })); });
    expect(batch.set.mock.calls[0][1]).toEqual(expect.objectContaining({ threadId: 't1', characterId: 'c1', status: 'pending', content: 'Aldric drew his sword and waited.' }));
    expect(batch.update).toHaveBeenCalledWith(expect.anything(), { updatedAt: 'now', postCount: { increment: 1 } });
    expect(batch.commit).toHaveBeenCalled();
  });

  it('rejects a too-short reply', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Continue the tale as Aldric…' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Reply' }), { target: { value: 'Short' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post reply' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Post must be at least 10 characters.');
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('a sealed thread takes no replies from players', async () => {
    threadDoc = { ...threadDoc, isLocked: true };
    await renderView();
    expect(screen.getByText('This thread is sealed. No new posts can be added.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue the tale/ })).not.toBeInTheDocument();
  });

  it('moderators can still reply to a sealed thread and see thread tools', async () => {
    threadDoc = { ...threadDoc, isLocked: true };
    signedIn({ userRole: 'moderator' });
    await renderView();
    expect(screen.getByRole('button', { name: /Continue the tale/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unseal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete thread/ })).toBeInTheDocument();
  });

  it('guests are invited to sign in', async () => {
    signedIn({ user: null, characters: [], activeCharId: null });
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Login / Signup' }));
    expect(props.onRequireAuth).toHaveBeenCalled();
    expect(firestore.updateDoc).not.toHaveBeenCalled(); // guests don't count views
  });
});
