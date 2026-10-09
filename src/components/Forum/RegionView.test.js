import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import RegionView from '@/components/Forum/RegionView';
import { useGame } from '@/context/GameContext';
import { deleteObject } from 'firebase/storage';
import * as firestore from 'firebase/firestore';

jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), deleteObject: jest.fn() }));
jest.mock('firebase/firestore');
jest.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));

const mockLocations = { locations: [], activity: [], loading: false, markAllRead: jest.fn() };
jest.mock('@/hooks/useCharacterLocations', () => jest.fn(() => mockLocations));
jest.mock('@/hooks/useRegionNames', () => jest.fn(() => (id) => `Region ${id}`));

jest.mock('@/components/ImageUploader', () => function MockImageUploader({ onImageChanged }) {
  return <button type="button" data-testid="mock-image-uploader" onClick={() => onImageChanged('https://firebasestorage.googleapis.com/b/x/o/test.jpg', 'center')}>Upload Image</button>;
});
jest.mock('@/components/MarkdownEditor', () => function MockMarkdownEditor({ value, onChange, onPost, submitLabel, isSubmitDisabled }) {
  return (
    <div>
      <textarea aria-label="Opening post" value={value} onChange={onChange} />
      <button type="button" onClick={onPost} disabled={isSubmitDisabled}>{submitLabel}</button>
    </div>
  );
});

const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const THREADS = [
  { id: 't1', title: 'Smoke over the Ember Road', regionId: '125', status: 'approved', postCount: 4, views: 124, tags: ['Roleplay', 'Ongoing'], excerpt: 'The smoke rose in a single black thread.', lastPostBy: 'Lyra Moonwhisper', lastPostAt: ts(Date.now() - 18 * 60000), updatedAt: ts(5000) },
  { id: 't2', title: 'The Night Watch', regionId: '125', status: 'approved', postCount: 2, views: 1, isLocked: true, createdBy: 'Aldric Vane', updatedAt: ts(4000) },
  { id: 't3', title: 'My Pending Tale', regionId: '125', status: 'pending', postCount: 1, createdBy: 'Aldric Vane', updatedAt: ts(3000) },
];

describe('RegionView', () => {
  const props = { region: { id: 125, name: 'Thornwatch Ridge' }, setView: jest.fn(), setActiveThread: jest.fn(), onRequireAuth: jest.fn() };
  let batch;
  const signedIn = (extra = {}) => useGame.mockReturnValue({
    user: { uid: 'u1' }, userRole: 'user', readReceipts: { t2: 9999 },
    characters: [{ id: 'c1', name: 'Aldric Vane', race: 'Human', class: 'Paladin' }], activeCharId: 'c1', ...extra
  });

  beforeEach(() => {
    jest.clearAllMocks();
    signedIn();
    batch = { set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn(() => Promise.resolve()) };
    firestore.writeBatch.mockReturnValue(batch);
    firestore.serverTimestamp.mockReturnValue('now');
    firestore.collection.mockImplementation((_, ...path) => ({ path: path.join('/') }));
    firestore.doc.mockImplementation((parent, ...path) => ({ path: path.length ? path.join('/') : `${parent.path}/new` }));
    firestore.query.mockImplementation((ref) => ref);
    firestore.onSnapshot.mockImplementation((ref, cb) => {
      if (ref.path?.includes('region_metadata')) cb({ exists: () => true, data: () => ({ name: 'Thornwatch Ridge', blurb: 'Wind-scoured cliffs.' }) });
      else cb({ docs: THREADS.map(t => ({ id: t.id, data: () => t })) });
      return jest.fn();
    });
    firestore.setDoc.mockResolvedValue();
  });

  const renderView = async (p = {}) => { await act(async () => { render(<RegionView {...props} {...p} />); }); };

  it('shows the banner with the region name, blurb and crest', async () => {
    await renderView();
    expect(screen.getByRole('heading', { level: 1, name: 'Thornwatch Ridge' })).toBeInTheDocument();
    expect(screen.getByText('Wind-scoured cliffs.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit region blurb' })).not.toBeInTheDocument();
  });

  it('lists threads with excerpt, tags, stats and last poster', async () => {
    await renderView();
    const rows = within(screen.getByRole('region', { name: 'Threads' })).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    const first = within(rows[0]);
    expect(first.getByRole('button', { name: 'Smoke over the Ember Road' })).toBeInTheDocument();
    expect(first.getByText('The smoke rose in a single black thread.')).toBeInTheDocument();
    expect(first.getByText('Roleplay')).toBeInTheDocument();
    expect(first.getByText('3')).toBeInTheDocument(); // replies = postCount - 1
    expect(first.getByText('124')).toBeInTheDocument();
    expect(first.getByText('Lyra')).toBeInTheDocument();
    expect(first.getByText('18 min ago')).toBeInTheDocument();
    expect(first.getByText('New')).toBeInTheDocument();
    // Read thread has no New badge; locked and pending markers show
    expect(within(rows[1]).queryByText('New')).not.toBeInTheDocument();
    expect(within(rows[1]).getByText('Sacred Text')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Awaiting approval')).toBeInTheDocument();
  });

  it('opens a thread', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: 'The Night Watch' }));
    expect(props.setActiveThread).toHaveBeenCalledWith(expect.objectContaining({ id: 't2' }));
    // setActiveThread navigates; a second setView would add another history entry
    expect(props.setView).not.toHaveBeenCalled();
  });

  it('breadcrumb returns to the world map', async () => {
    await renderView();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', { name: 'World Map' }));
    expect(props.setView).toHaveBeenCalledWith('map');
  });

  it('search filters by title, excerpt, tag or poster', async () => {
    await renderView();
    const search = screen.getByRole('searchbox', { name: 'Search threads in this location' });
    fireEvent.change(search, { target: { value: 'ongoing' } });
    expect(screen.getByRole('button', { name: 'Smoke over the Ember Road' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'The Night Watch' })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'dragons' } });
    expect(screen.getByText('No threads match “dragons”')).toBeInTheDocument();
  });

  it('shows the Locations and Recent activity panels to signed-in players', async () => {
    await renderView();
    expect(screen.getAllByText('Locations').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeInTheDocument();
  });

  describe('guests', () => {
    beforeEach(() => signedIn({ user: null, characters: [], activeCharId: null, readReceipts: {} }));

    it('see no player panels or New badges, and New thread asks them to sign in', async () => {
      await renderView();
      expect(screen.queryByRole('heading', { name: 'Recent activity' })).not.toBeInTheDocument();
      expect(screen.queryByText('New')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'New thread' }));
      expect(props.onRequireAuth).toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: 'New thread' })).not.toBeInTheDocument();
    });
  });

  describe('moderators', () => {
    beforeEach(() => signedIn({ userRole: 'moderator' }));

    it('edit the region blurb', async () => {
      await renderView();
      fireEvent.click(screen.getByRole('button', { name: 'Edit region blurb' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Region blurb' }), { target: { value: 'Cold winds.' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
      expect(firestore.setDoc).toHaveBeenCalledWith(expect.anything(), { blurb: 'Cold winds.' }, { merge: true });
    });

    it('rename the region', async () => {
      await renderView();
      fireEvent.click(screen.getByRole('button', { name: /Rename/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Region name' }), { target: { value: 'Thornwatch Heights' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
      expect(firestore.setDoc).toHaveBeenCalledWith(expect.anything(), { name: 'Thornwatch Heights' }, { merge: true });
    });
  });

  describe('new thread', () => {
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'New thread' }));

    it('creates the thread, its first post and a read receipt with up to 3 tags', async () => {
      await renderView();
      open();
      expect(within(screen.getByRole('region', { name: 'New thread' })).getByText('Aldric Vane')).toBeInTheDocument();
      fireEvent.change(screen.getByRole('textbox', { name: 'Thread title' }), { target: { value: 'Lanterns in the Marsh' } });
      for (const t of ['Lore', 'Open', 'Ongoing']) fireEvent.click(screen.getByRole('button', { name: t, pressed: false }));
      expect(screen.getByRole('button', { name: 'Trade' })).toBeDisabled();
      fireEvent.change(screen.getByRole('textbox', { name: 'Opening post' }), { target: { value: 'Lanterns drift over the water at night.' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create thread' })); });

      const threadData = batch.set.mock.calls[0][1];
      expect(threadData).toEqual(expect.objectContaining({ title: 'Lanterns in the Marsh', tags: ['Lore', 'Open', 'Ongoing'], status: 'pending', regionId: '125', characterId: 'c1' }));
      expect(batch.set.mock.calls[1][1]).toEqual(expect.objectContaining({ content: 'Lanterns drift over the water at night.', status: 'pending' }));
      expect(batch.set).toHaveBeenCalledTimes(3); // thread, post, read receipt
      expect(batch.commit).toHaveBeenCalled();
    });

    it('validates the title and opening post', async () => {
      await renderView();
      open();
      fireEvent.change(screen.getByRole('textbox', { name: 'Thread title' }), { target: { value: 'Hi' } });
      fireEvent.change(screen.getByRole('textbox', { name: 'Opening post' }), { target: { value: 'Short' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create thread' })); });
      expect(screen.getByRole('alert')).toHaveTextContent('Title must be at least 3 characters.');
      expect(batch.commit).not.toHaveBeenCalled();
    });

    it('requires an active character', async () => {
      signedIn({ activeCharId: null });
      await renderView();
      open();
      fireEvent.change(screen.getByRole('textbox', { name: 'Thread title' }), { target: { value: 'A Proper Title' } });
      fireEvent.change(screen.getByRole('textbox', { name: 'Opening post' }), { target: { value: 'Plenty of words here.' } });
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create thread' })); });
      expect(screen.getByRole('alert')).toHaveTextContent('Select a character before creating a thread.');
    });

    it('cancelling deletes images uploaded in the form', async () => {
      deleteObject.mockResolvedValue();
      await renderView();
      open();
      fireEvent.click(screen.getByTestId('mock-image-uploader'));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
      expect(deleteObject).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('region', { name: 'New thread' })).not.toBeInTheDocument();
    });

    it('warns but still closes when cleanup is refused', async () => {
      const err = new Error('denied'); err.code = 'storage/unauthorized';
      deleteObject.mockRejectedValue(err);
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      await renderView();
      open();
      fireEvent.click(screen.getByTestId('mock-image-uploader'));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
      expect(screen.getByRole('status')).toHaveTextContent('Failed to cleanup 1 temporary image(s)');
      expect(screen.queryByRole('region', { name: 'New thread' })).not.toBeInTheDocument();
      console.warn.mockRestore();
    });
  });
});
