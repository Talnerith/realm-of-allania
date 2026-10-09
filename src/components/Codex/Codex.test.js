import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import CodexIndex from '@/components/Codex/CodexIndex';
import CodexEntry from '@/components/Codex/CodexEntry';
import { useGame } from '@/context/GameContext';
import * as firestore from 'firebase/firestore';

jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('firebase/firestore');
jest.mock('firebase/storage', () => ({ ref: jest.fn(), deleteObject: jest.fn() }));
jest.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));
jest.mock('@/lib/profiles', () => ({ useProfile: () => ({ displayName: 'Emberquill' }), authorName: (p) => p?.displayName || 'Unknown author' }));
jest.mock('@/hooks/useMediaQuery', () => jest.fn(() => true));
jest.mock('@/components/ImageUploader', () => function MockUploader() { return null; });
jest.mock('@/components/MarkdownEditor', () => function MockEditor({ value, onChange }) {
  return <textarea aria-label="Page text" value={value} onChange={onChange} />;
});
jest.mock('@/components/RichText', () => function MockRichText({ content }) { return <div>{content}</div>; });

const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const PAGES = [
  { id: 'k1', title: 'Zekiel', category: 'Characters', tags: ['Historical', 'Deceased'], status: 'approved', creatorId: 'u2',
    content: '> A blade in the dunes.\n\n**Race:** Human\n**Class:** Rogue\n**Allegiance:** None\n\nHe walks alone.\n\nRaised in [[Breville]].\n\n> He leaves questions.', updatedAt: ts(Date.now() - 3 * 86400000) },
  { id: 'k2', title: 'Breville', category: 'Locations', tags: ['City'], status: 'approved', isLocked: true, creatorId: 'u3', content: 'The grey bastion.' },
  { id: 'k3', title: 'Atman and Samsara', category: 'Magic and Powers', status: 'approved', creatorId: 'u2', content: 'A faith.' },
  { id: 'k4', title: 'Corain', category: 'Species', status: 'pending', creatorId: 'u1', content: 'A ruler.' },
  { id: 'k5', title: 'Kitsune', category: 'Characters', status: 'approved', creatorId: 'u2', content: 'A bloodline.' },
];

beforeEach(() => {
  jest.clearAllMocks();
  useGame.mockReturnValue({ user: { uid: 'u1' }, userRole: 'user', characters: [], activeCharId: null });
  firestore.collection.mockImplementation((_, ...path) => ({ path: path.join('/') }));
  firestore.query.mockImplementation((ref) => ref);
  firestore.doc.mockImplementation((_, ...path) => ({ path: path.join('/') }));
  firestore.serverTimestamp.mockReturnValue('now');
  firestore.onSnapshot.mockImplementation((ref, cb) => { cb({ docs: PAGES.map(p => ({ id: p.id, data: () => p })) }); return jest.fn(); });
  firestore.addDoc.mockResolvedValue({ id: 'new1' });
  firestore.updateDoc.mockResolvedValue();
  window.alert = jest.fn();
});

describe('CodexIndex', () => {
  const props = { onOpenEntry: jest.fn(), onRequireAuth: jest.fn() };
  const renderIndex = async () => { await act(async () => { render(<CodexIndex {...props} />); }); };

  it('sorts pages into the Characters, Locations and History sections', async () => {
    await renderIndex();
    const chars = within(screen.getByRole('region', { name: 'Characters' }));
    expect(chars.getByRole('button', { name: 'Open Zekiel' })).toBeInTheDocument();
    expect(chars.getByRole('button', { name: 'Open Corain' })).toBeInTheDocument(); // Species -> Characters
    expect(chars.getByText('Awaiting approval')).toBeInTheDocument();
    const locs = within(screen.getByRole('region', { name: 'Locations' }));
    expect(locs.getByText('Sacred')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'History' })).getByRole('button', { name: 'Open Atman and Samsara' })).toBeInTheDocument();
    expect(chars.getByText('Historical')).toBeInTheDocument();
  });

  it('letter strip enables only letters with pages', async () => {
    await renderIndex();
    const strip = within(screen.getByRole('navigation', { name: 'Jump to letter in Characters' }));
    expect(strip.getByRole('button', { name: 'Jump to Z' })).toBeEnabled();
    expect(strip.getByRole('button', { name: 'No characters starting with A' })).toBeDisabled();
  });

  it('search filters by title and tag', async () => {
    await renderIndex();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search codex pages' }), { target: { value: 'city' } });
    expect(screen.getByRole('button', { name: 'Open Breville' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Zekiel' })).not.toBeInTheDocument();
    expect(screen.getAllByText('No pages match “city”.')).toHaveLength(2);
  });

  it('opens an entry', async () => {
    await renderIndex();
    fireEvent.click(screen.getByRole('button', { name: 'Open Kitsune' }));
    expect(props.onOpenEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'k5' }));
  });

  it('New Page collects title, section and tags, then opens the editor', async () => {
    await renderIndex();
    fireEvent.click(screen.getByRole('button', { name: 'New Page' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Page title' }), { target: { value: 'Lothias' } });
    fireEvent.click(screen.getByRole('button', { name: 'Characters', pressed: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Historical' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New tag' }), { target: { value: 'Mystic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    expect(props.onOpenEntry).toHaveBeenCalledWith({ isNew: true, title: 'Lothias', category: 'Characters', tags: ['Historical', 'Mystic'] });
  });

  it('guests are asked to sign in before creating', async () => {
    useGame.mockReturnValue({ user: null, userRole: 'user', characters: [], activeCharId: null });
    await renderIndex();
    fireEvent.click(screen.getByRole('button', { name: 'New Page' }));
    expect(props.onRequireAuth).toHaveBeenCalled();
  });
});

describe('CodexEntry', () => {
  const props = { goBack: jest.fn(), onWikiLink: jest.fn(), onOpenEntry: jest.fn() };
  const renderEntry = async (page = PAGES[0]) => { await act(async () => { render(<CodexEntry page={page} {...props} />); }); };

  it('shows the parsed entry: quotes, key facts, quick facts, related entries and author list', async () => {
    await renderEntry();
    expect(screen.getByRole('heading', { level: 1, name: 'Zekiel' })).toBeInTheDocument();
    expect(screen.getByText('“A blade in the dunes.”')).toBeInTheDocument();
    expect(screen.getByText('“He leaves questions.”')).toBeInTheDocument();
    expect(screen.getByText('Race')).toBeInTheDocument();
    // Characters show Race and Class beside the opening; Quick Facts lists every fact
    expect(screen.getByText('Race')).toBeInTheDocument();
    expect(screen.queryByText('Allegiance')).not.toBeInTheDocument();
    expect(screen.getByText('Allegiance:')).toBeInTheDocument();
    const aside = within(screen.getByRole('complementary', { name: 'Quick facts and related entries' }));
    fireEvent.click(aside.getByRole('button', { name: /Breville/ }));
    expect(props.onOpenEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'k2' }));
    const roster = within(screen.getByRole('complementary', { name: "Emberquill's Characters" }));
    expect(roster.getByRole('button', { name: 'Kitsune' })).toBeInTheDocument();
    expect(roster.getByRole('button', { name: 'Zekiel' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Written by')).toHaveTextContent('Written by Emberquill');
  });

  it('breadcrumbs go back to the codex', async () => {
    await renderEntry();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', { name: 'Characters' }));
    expect(props.goBack).toHaveBeenCalled();
  });

  it('a sealed page cannot be edited by players', async () => {
    await renderEntry(PAGES[1]);
    expect(screen.getByText('Sacred Text')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit entry' })).not.toBeInTheDocument();
  });

  it('saving an edit sends it back to moderation with tags', async () => {
    await renderEntry();
    fireEvent.click(screen.getByRole('button', { name: 'Edit entry' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Add a tag' }), { target: { value: 'Rogue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save page' })); });
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      { path: 'artifacts/realm-of-allania-v2/public/data/codex_pages/k1' },
      expect.objectContaining({ status: 'pending', tags: ['Historical', 'Deceased', 'Rogue'], category: 'Characters', lastEditorId: 'u1' })
    );
  });

  it('a new page is created as pending in the chosen section', async () => {
    await renderEntry({ isNew: true, title: 'Lothias', category: 'Characters', tags: ['Mystic'] });
    fireEvent.change(screen.getByRole('textbox', { name: 'Page text' }), { target: { value: 'A priest of the old ways.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Locations' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save page' })); });
    expect(firestore.addDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      title: 'Lothias', category: 'Locations', tags: ['Mystic'], status: 'pending', creatorId: 'u1'
    }));
  });

  it('validates the title and text', async () => {
    await renderEntry({ isNew: true, title: '  ', category: 'Characters' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save page' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.');
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });
});
