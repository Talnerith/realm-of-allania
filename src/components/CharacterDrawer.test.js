import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CharacterDrawer from '@/components/CharacterDrawer';
import { useGame } from '@/context/GameContext';
import * as firestore from 'firebase/firestore';
import * as storage from 'firebase/storage';

// Mock dependencies
jest.mock('@/context/GameContext');
jest.mock('@/lib/firebase', () => ({
  db: {},
  storage: {}
}));
jest.mock('firebase/firestore');
jest.mock('firebase/storage');
jest.mock('@/components/ImageUploader', () => {
  return function MockImageUploader({ onImageChanged, initialUrl }) {
    return (
      <div data-testid="image-uploader">
        <button type="button" onClick={() => onImageChanged(initialUrl, '20% 20%')}>
          Drag Focus
        </button>
        <button
          type="button"
          onClick={() => onImageChanged('http://mock.url/image.jpg', '50% 50%')}
          data-testid="mock-upload-btn"
        >
          Upload Image
        </button>
      </div>
    );
  };
});
jest.mock('lucide-react', () => ({
  ChevronUp: () => <div data-testid="icon-chevron-up" />,
  Plus: () => <div data-testid="icon-plus" />,
  X: () => <div data-testid="icon-x" />,
  Trash2: () => <div data-testid="icon-trash" />,
  AlertTriangle: () => <div data-testid="icon-alert-triangle" />,
  Loader: () => <div data-testid="icon-loader" />,
}));

describe('CharacterDrawer', () => {
  const mockUser = { uid: 'user123' };
  const mockCharacters = [
    { id: 'char1', name: 'Char One', race: 'Human', class: 'Fighter', description: 'Desc One', imageUrl: 'https://firebasestorage.googleapis.com/b/app/o/img1.jpg', imagePosition: 'center' },
    { id: 'char2', name: 'Char Two', race: 'Elf', class: 'Mage', description: 'Desc Two', imageUrl: 'https://firebasestorage.googleapis.com/b/app/o/img2.jpg', imagePosition: 'top' },
  ];
  const mockSetActiveCharId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useGame.mockReturnValue({
      user: mockUser,
      characters: mockCharacters,
      characterCount: 2,
      activeCharId: 'char1',
      setActiveCharId: mockSetActiveCharId,
    });

    // Mock Firestore functions
    firestore.collection.mockReturnValue('collectionRef');
    firestore.doc.mockImplementation((_, ...path) => ({ path: path.join('/') }));
    firestore.writeBatch.mockReturnValue({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(true),
    });
    firestore.getDocs.mockResolvedValue({
      empty: true,
      docs: [],
    });
    firestore.serverTimestamp.mockReturnValue('timestamp');
  });

  const openDrawer = () => fireEvent.click(screen.getByRole('button', { name: 'Open Character Roster' }));

  test('renders the roster bar with the active character and count', () => {
    render(<CharacterDrawer />);
    expect(screen.getByText('Character Roster')).toBeInTheDocument();
    expect(screen.getByText('Playing as:')).toBeInTheDocument();
    expect(screen.getByText('Char One')).toBeInTheDocument();
    expect(screen.getByText('2 / 10')).toBeInTheDocument();
  });

  test('shows "No character selected" without an active character', () => {
    useGame.mockReturnValue({ user: mockUser, characters: mockCharacters, activeCharId: null, setActiveCharId: mockSetActiveCharId });
    render(<CharacterDrawer />);
    expect(screen.getByText('No character selected')).toBeInTheDocument();
  });

  test('opens and closes the drawer (bar, backdrop and Escape)', () => {
    const { container } = render(<CharacterDrawer />);
    const bar = screen.getByRole('button', { name: 'Open Character Roster' });
    expect(bar).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Char Two')).not.toBeInTheDocument();

    fireEvent.click(bar);
    expect(bar).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Char Two')).toBeInTheDocument();

    // Backdrop
    fireEvent.click(container.querySelector('.bg-black\\/50'));
    expect(bar).toHaveAttribute('aria-expanded', 'false');

    // Escape
    fireEvent.click(bar);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(bar).toHaveAttribute('aria-expanded', 'false');
  });

  test('switches active character by clicking the card', () => {
    render(<CharacterDrawer />);
    openDrawer();
    fireEvent.click(screen.getByText('Elf · Mage'));
    expect(mockSetActiveCharId).toHaveBeenCalledWith('char2');
  });

  test('marks the active card', () => {
    render(<CharacterDrawer />);
    openDrawer();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Char One/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Char Two/, pressed: false })).toBeInTheDocument();
  });

  test('shows the initial when a character has no portrait', () => {
    useGame.mockReturnValue({
      user: mockUser,
      characters: [{ id: 'c3', name: 'Wren Hollow', race: 'Elf', class: 'Druid' }],
      activeCharId: null,
      setActiveCharId: mockSetActiveCharId,
    });
    const { container } = render(<CharacterDrawer />);
    openDrawer();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(container.querySelectorAll('img[src=""]')).toHaveLength(0);
  });

  test('opens creator and submits new character', async () => {
    render(<CharacterDrawer />);
    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /New Character/ }));
    expect(screen.getByText('Create Identity')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Hero' } });
    fireEvent.change(screen.getByLabelText('Race'), { target: { value: 'Human' } });
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'Warrior / Fighter' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A brave hero.' } });
    expect(screen.getByLabelText('Create Codex Entry?')).toBeChecked();

    fireEvent.click(screen.getByTestId('mock-upload-btn'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Summon' }));
    });

    const mockBatch = firestore.writeBatch();
    expect(mockBatch.set).toHaveBeenCalledTimes(2); // Character + Codex
    expect(mockBatch.update).toHaveBeenCalledTimes(1); // User character count
    expect(mockBatch.commit).toHaveBeenCalled();

    const charArg = mockBatch.set.mock.calls[0][1];
    expect(charArg.name).toBe('New Hero');
    expect(charArg.imageUrl).toBe('http://mock.url/image.jpg');

    expect(mockSetActiveCharId).toHaveBeenCalled(); // the new character becomes active
  });

  test('requires a name before creating', async () => {
    render(<CharacterDrawer />);
    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /New Character/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Summon' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
    expect(firestore.writeBatch().commit).not.toHaveBeenCalled();
  });

  test('cancelling the creator deletes uploads made in the form', async () => {
    render(<CharacterDrawer />);
    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: /New Character/ }));
    fireEvent.click(screen.getByTestId('mock-upload-btn'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /New Character/ })).toBeInTheDocument();
  });

  test('shows Limit Reached at 10 characters', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: `Hero ${i}`, race: 'Human', class: 'Bard' }));
    useGame.mockReturnValue({ user: mockUser, characters: ten, activeCharId: 'c0', setActiveCharId: mockSetActiveCharId });
    render(<CharacterDrawer />);
    expect(screen.getByText('10 / 10')).toHaveClass('text-red-400');
    openDrawer();
    expect(screen.getByRole('button', { name: /Limit Reached/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /New Character/ })).not.toBeInTheDocument();
  });

  test('opens editor and updates character', async () => {
    render(<CharacterDrawer />);
    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Char One' }));

    expect(screen.getByText('Edit Identity')).toBeInTheDocument();
    expect(screen.queryByLabelText('Create Codex Entry?')).not.toBeInTheDocument();
    expect(mockSetActiveCharId).not.toHaveBeenCalled(); // the pen doesn't also select the card

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Char One Updated' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    });

    expect(firestore.updateDoc).toHaveBeenCalled();
    const updateArg = firestore.updateDoc.mock.calls[0][1];
    expect(updateArg.name).toBe('Char One Updated');
  });

  test('renaming only updates the character (the syncCharacter function updates posts)', async () => {
    render(<CharacterDrawer />);
    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Char One' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Char One Evolved' } });
    fireEvent.click(screen.getByTestId('mock-upload-btn')); // Change image

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    });

    expect(firestore.updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ name: 'Char One Evolved' }));
    // No client-side post queries or rewrites (rules forbid them)
    expect(firestore.getDocs).not.toHaveBeenCalled();
    expect(firestore.writeBatch().update).not.toHaveBeenCalled();
  });

  test('blocks names with blocked or staff-impersonating words', async () => {
    render(<CharacterDrawer />);
    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Char One' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Official Moderator' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/can't suggest site staff/);
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  test('the bar trash button opens the drawer into the delete flow', () => {
    render(<CharacterDrawer />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete character' }));
    expect(screen.getByRole('button', { name: 'Close Character Roster' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Delete Character')).toBeInTheDocument();
  });

  test('deletes character and decrements the count, keeping the portrait for its codex page', async () => {
    render(<CharacterDrawer />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete character' }));
    fireEvent.change(screen.getByLabelText('Character'), { target: { value: 'char2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText(/will be removed from your roster/)).toHaveTextContent('Char Two');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete' }));
    });

    const mockBatch = firestore.writeBatch();
    expect(mockBatch.delete).toHaveBeenCalledWith({ path: 'artifacts/realm-of-allania-v2/users/user123/characters/char2' });
    expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), { characterCount: firestore.increment(-1), lastDeletedCharId: 'char2' });
    expect(mockBatch.commit).toHaveBeenCalled();
    // Posts/threads/codex are handled server-side by syncCharacter
    expect(firestore.getDocs).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  test('an older account with a count of 0 deletes without decrementing', async () => {
    useGame.mockReturnValue({ ...useGame(), characterCount: 0 });
    render(<CharacterDrawer />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete character' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete' })); });
    const mockBatch = firestore.writeBatch();
    expect(mockBatch.delete).toHaveBeenCalled();
    expect(mockBatch.update).not.toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  describe('portrait files', () => {
    const editCharOne = () => {
      render(<CharacterDrawer />);
      openDrawer();
      fireEvent.click(screen.getByRole('button', { name: 'Edit Char One' }));
    };
    const cancel = async () => {
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    };

    test('cancelling after moving the focus point keeps the saved portrait', async () => {
      editCharOne();
      fireEvent.click(screen.getByRole('button', { name: 'Drag Focus' }));
      await cancel();
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    test('cancelling deletes only the new upload', async () => {
      editCharOne();
      fireEvent.click(screen.getByTestId('mock-upload-btn'));
      fireEvent.click(screen.getByRole('button', { name: 'Drag Focus' }));
      await cancel();
      expect(storage.ref).toHaveBeenCalledTimes(1);
      expect(storage.ref).toHaveBeenCalledWith(expect.anything(), 'http://mock.url/image.jpg');
      expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    });

    test('saving a new portrait keeps the old file (the codex page uses it)', async () => {
      editCharOne();
      fireEvent.click(screen.getByTestId('mock-upload-btn'));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save Changes' })); });
      expect(firestore.updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ imageUrl: 'http://mock.url/image.jpg' }));
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });
  });

  test('cancelling the confirmation goes back a step without deleting', () => {
    render(<CharacterDrawer />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete character' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Character')).toBeInTheDocument();
    expect(firestore.writeBatch().commit).not.toHaveBeenCalled();
  });

  describe('CharacterDrawer Accessibility', () => {
    const heroes = [
      { id: 'c1', name: 'Hero 1', race: 'Human', class: 'Fighter' },
      { id: 'c2', name: 'Hero 2', race: 'Elf', class: 'Mage' }
    ];

    beforeEach(() => {
      useGame.mockReturnValue({
        user: { uid: 'u1' },
        characters: heroes,
        activeCharId: 'c1',
        setActiveCharId: mockSetActiveCharId,
      });
    });

    test('Drawer toggle is keyboard accessible', () => {
      render(<CharacterDrawer />);
      const toggleBtn = screen.getByRole('button', { name: /Open Character Roster|Close Character Roster/i });

      expect(toggleBtn).toHaveAttribute('tabIndex', '0');
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

      fireEvent.keyDown(toggleBtn, { key: 'Enter', code: 'Enter' });
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

      fireEvent.keyDown(toggleBtn, { key: ' ', code: 'Space' });
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    });

    test('Character cards are selected through a real button', () => {
      render(<CharacterDrawer />);
      openDrawer();
      const select = screen.getByRole('button', { name: /Hero 2/, pressed: false });
      expect(select.tagName).toBe('BUTTON');
      fireEvent.click(select);
      expect(mockSetActiveCharId).toHaveBeenCalledWith('c2');
      expect(mockSetActiveCharId).toHaveBeenCalledTimes(1);
    });

    test('Interactive elements have appropriate aria-labels', () => {
      render(<CharacterDrawer />);
      openDrawer();
      expect(screen.getByLabelText('Delete character')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit Hero 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit Hero 2')).toBeInTheDocument();
    });
  });
});
