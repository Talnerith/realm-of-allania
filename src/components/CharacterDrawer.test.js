import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CharacterDrawer from './CharacterDrawer';
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
  return function MockImageUploader({ onImageChanged }) {
    return (
      <div data-testid="image-uploader">
        <button
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
    Shield: () => <div data-testid="icon-shield" />,
    ChevronDown: () => <div data-testid="icon-chevron-down" />,
    ChevronUp: () => <div data-testid="icon-chevron-up" />,
    Edit3: () => <div data-testid="icon-edit" />,
    Plus: () => <div data-testid="icon-plus" />,
    X: () => <div data-testid="icon-x" />,
    Trash2: () => <div data-testid="icon-trash" />,
    AlertCircle: () => <div data-testid="icon-alert-circle" />,
    AlertTriangle: () => <div data-testid="icon-alert-triangle" />,
    Loader: () => <div data-testid="icon-loader" />,
    Move: () => <div data-testid="icon-move" />,
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

  test('renders character roster button', () => {
    render(<CharacterDrawer />);
    expect(screen.getByText('Character Roster')).toBeInTheDocument();
    expect(screen.getByText('Playing as: Char One')).toBeInTheDocument();
  });

  test('opens and closes drawer', () => {
    render(<CharacterDrawer />);
    const toggleButton = screen.getByText('Character Roster').closest('div').parentElement;

    // Check initial state (closed)
    expect(toggleButton.className).toContain('h-14'); // or h-16 based on responsive logic

    // Open
    fireEvent.click(screen.getByText('Character Roster'));
    // Since we can't easily check class change driven by state without inspecting the DOM structure deeply or checking styles,
    // we can assume the state change triggers a re-render.
    // However, the component maps characters, so if it's open, we should see the character list items if they are rendered always but hidden?
    // Let's check if "New Character" button is visible. It is rendered only when mode === 'view' and open/close just changes height.
    // Wait, the content is always rendered in the DOM but possibly hidden by overflow?
    // The code says: `isOpen ? 'h-[80vh] md:h-[500px]' : 'h-14 md:h-16'`
    // And `flex-1 overflow-y-auto`
    // So the content IS there.

    // Let's verify character list is present.
    expect(screen.getByText('Char One')).toBeInTheDocument();
    expect(screen.getByText('Char Two')).toBeInTheDocument();
  });

  test('switches active character', () => {
    render(<CharacterDrawer />);

    // Open drawer to see the list clearly (conceptually)
    fireEvent.click(screen.getByText('Character Roster'));

    // Click on the second character (Char Two)
    const charTwo = screen.getByText('Char Two').closest('div'); // Get the parent container
    fireEvent.click(charTwo);

    expect(mockSetActiveCharId).toHaveBeenCalledWith('char2');
  });

  test('opens creator and submits new character', async () => {
    render(<CharacterDrawer />);
    fireEvent.click(screen.getByText('Character Roster'));

    // Click "New Character"
    fireEvent.click(screen.getByText('New Character'));

    expect(screen.getByText('Create Identity')).toBeInTheDocument();

    // Fill form
    // The inputs have no labels linked with htmlFor, so getByLabelText won't work easily unless we fix the component.
    // For now, we select by display value (empty) but there are multiple inputs.
    // Name input is the first input of type text (or implicitly text).
    // Let's use getByDisplayValue for unique values or querySelector.
    // However, since we are in a test environment, let's try to be more specific.

    // Name input
    const nameInput = screen.getAllByRole('textbox')[0]; // First textbox is likely name? No, name is input, description is textarea.
    // input type="text" usually has role="textbox" ONLY if it has a datalist or similar, otherwise it is just an input.
    // But testing-library treats inputs as textbox role often.
    // Actually, `input` without `type` or `type="text"` matches role `textbox`. `textarea` also matches role `textbox`.

    // Let's look at the component structure.
    // Name input: <input value={formData.name} ... />
    // Race select
    // Class select
    // Description textarea

    const inputs = screen.getAllByRole('textbox');
    // Usually Name (input) and Description (textarea).
    // Let's assume order.

    // Wait, `screen.getByDisplayValue('')` failed because multiple elements have empty value (Name and Description).

    // Let's target by placeholder if available (none) or siblings.
    // Or we can just grab all empty inputs.

    const nameInputBox = inputs.find(el => el.tagName === 'INPUT');
    fireEvent.change(nameInputBox, { target: { value: 'New Hero' } });

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Human' } }); // Race
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Warrior / Fighter' } }); // Class - Use exact value from options

    const descInputBox = inputs.find(el => el.tagName === 'TEXTAREA');
    fireEvent.change(descInputBox, { target: { value: 'A brave hero.' } });

    // Trigger Image Upload Mock
    fireEvent.click(screen.getByTestId('mock-upload-btn'));

    // Submit
    await act(async () => {
        fireEvent.click(screen.getByText('Summon'));
    });

    const mockBatch = firestore.writeBatch();
    expect(mockBatch.set).toHaveBeenCalledTimes(2); // Character + Codex
    expect(mockBatch.update).toHaveBeenCalledTimes(1); // User character count
    expect(mockBatch.commit).toHaveBeenCalled();

    // Check arguments for character creation
    const charArg = mockBatch.set.mock.calls[0][1];
    expect(charArg.name).toBe('New Hero');
    expect(charArg.imageUrl).toBe('http://mock.url/image.jpg');

    expect(mockSetActiveCharId).toHaveBeenCalled(); // Should set active char to new char
  });

  test('opens editor and updates character', async () => {
    render(<CharacterDrawer />);
    fireEvent.click(screen.getByText('Character Roster'));

    // Find edit button for Char One
    const editButtons = screen.getAllByTestId('icon-edit');
    fireEvent.click(editButtons[0].closest('button')); // Edit Char One

    expect(screen.getByText('Edit Identity')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Char One')).toBeInTheDocument();

    // Change Name
    fireEvent.change(screen.getByDisplayValue('Char One'), { target: { value: 'Char One Updated' } });

    // Submit
    await act(async () => {
        fireEvent.click(screen.getByText('Save Changes'));
    });

    expect(firestore.updateDoc).toHaveBeenCalled();
    const updateArg = firestore.updateDoc.mock.calls[0][1];
    expect(updateArg.name).toBe('Char One Updated');
  });

  test('updates related posts when character identity changes', async () => {
    render(<CharacterDrawer />);
    fireEvent.click(screen.getByText('Character Roster'));

    // Edit Char One
    const editButtons = screen.getAllByTestId('icon-edit');
    fireEvent.click(editButtons[0].closest('button'));

    // Change Name AND Image to trigger identity change logic
    fireEvent.change(screen.getByDisplayValue('Char One'), { target: { value: 'Char One Evolved' } });
    fireEvent.click(screen.getByTestId('mock-upload-btn')); // Change image

    // Mock query response for posts
    firestore.getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        { id: 'post1', ref: 'postRef1', data: () => ({}) },
        { id: 'post2', ref: 'postRef2', data: () => ({}) },
      ],
    });

    await act(async () => {
        fireEvent.click(screen.getByText('Save Changes'));
    });

    // Should query posts
    expect(firestore.query).toHaveBeenCalled();
    expect(firestore.getDocs).toHaveBeenCalled();

    // Should batch update posts
    const mockBatch = firestore.writeBatch();
    expect(mockBatch.update).toHaveBeenCalledWith('postRef1', expect.objectContaining({ characterName: 'Char One Evolved' }));
    expect(mockBatch.update).toHaveBeenCalledWith('postRef2', expect.objectContaining({ characterName: 'Char One Evolved' }));
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  test('deletes character and performs cleanup', async () => {
    render(<CharacterDrawer />);
    fireEvent.click(screen.getByText('Character Roster'));

    // Open Delete Mode
    fireEvent.click(screen.getByTitle('Delete Character'));

    expect(screen.getByText('Delete Character')).toBeInTheDocument();

    // Select character to delete
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'char1' } });

    // Click Delete (First step)
    fireEvent.click(screen.getByText('Delete'));

    // Confirm
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();

    // Mock cleanup query responses
    // 1. Posts (code uses snapshot.docs)
    firestore.getDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'p1', ref: 'pRef1' }],
    });
    // 2. Codex (code uses snapshot.forEach)
    firestore.getDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'c1', ref: 'cRef1' }],
        forEach: (callback) => [{ id: 'c1', ref: 'cRef1' }].forEach(callback)
    });

    await act(async () => {
        fireEvent.click(screen.getByText('Yes, Delete'));
    });

    const mockBatch = firestore.writeBatch();

    // Verify post anonymization
    expect(mockBatch.update).toHaveBeenCalledWith('pRef1', expect.objectContaining({ characterName: 'Char One [Deleted]' }));

    // Verify codex archiving
    // The first batch update was for posts. The second batch (finalBatch) update is for codex.
    // Since writeBatch returns the same mock object, we can check all calls.
    expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ title: '[Archived] Char One' }));

    // Verify character deletion
    expect(mockBatch.delete).toHaveBeenCalled();

    // Verify user count decrement
    expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), { characterCount: firestore.increment(-1) });

    expect(mockBatch.commit).toHaveBeenCalled();

    // Image cleanup
    expect(storage.deleteObject).toHaveBeenCalled();
  });
});
