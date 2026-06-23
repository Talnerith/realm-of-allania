import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import RegionView from '@/components/Forum/RegionView';
import { useGame } from '@/context/GameContext';
import { ref, deleteObject } from 'firebase/storage';
import { onSnapshot, addDoc, setDoc, doc, collection, query, where } from 'firebase/firestore';

// Mocks
jest.mock('@/context/GameContext', () => ({
  useGame: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
}));

jest.mock('@/lib/firebase', () => ({
  db: {},
  storage: {},
}));

jest.mock('@/lib/constants', () => ({
  APP_ID: 'test_app_id',
}));

// Mock child components to simplify testing
jest.mock('@/components/ImageUploader', () => {
  return function MockImageUploader({ onImageChanged }) {
    return (
      <button
        data-testid="mock-image-uploader"
        onClick={() => onImageChanged('https://test-storage.com/test-image.jpg', 'center')}
      >
        Upload Image
      </button>
    );
  };
});

jest.mock('@/components/MarkdownEditor', () => {
  return function MockMarkdownEditor({ value, onChange, placeholder }) {
    return (
      <textarea
        data-testid="mock-markdown-editor"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    );
  };
});

describe('RegionView', () => {
  const mockRegion = { id: '1', name: 'Test Region' };
  const mockSetView = jest.fn();
  const mockSetActiveThread = jest.fn();
  const mockUser = { uid: 'user123' };
  const mockCharacters = [
    { id: 'char1', name: 'Test Hero', race: 'Human', class: 'Warrior', imageUrl: '', imagePosition: 'center' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    useGame.mockReturnValue({
      user: mockUser,
      userRole: 'user',
      readReceipts: {},
      characters: mockCharacters,
      activeCharId: 'char1',
    });

    // Default onSnapshot mock that provides region metadata and empty threads
    onSnapshot.mockImplementation((queryOrDoc, callback) => {
      // Check if this is the metadata doc or threads query
      if (typeof queryOrDoc === 'object') {
        // For metadata doc
        callback({ exists: () => true, data: () => ({ bannerUrl: '', name: 'Test Region' }) });
      }
      return jest.fn(); // unsubscribe
    });

    ref.mockReturnValue('mockRef');
    deleteObject.mockResolvedValue({});
    addDoc.mockResolvedValue({ id: 'new-thread-id' });
    setDoc.mockResolvedValue({});
  });

  describe('Thread Creation', () => {
    it('renders the new thread button', async () => {
      render(
        <RegionView
          region={mockRegion}
          setView={mockSetView}
          setActiveThread={mockSetActiveThread}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('New Thread')).toBeInTheDocument();
      });
    });

    it('opens creation form when clicking New Thread', async () => {
      render(
        <RegionView
          region={mockRegion}
          setView={mockSetView}
          setActiveThread={mockSetActiveThread}
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('New Thread'));
      });

      expect(screen.getByText('Post a New Topic')).toBeInTheDocument();
    });
  });

  describe('Cancel Thread Creation - Storage Cleanup', () => {
    it('displays error message when storage operation fails during cancel', async () => {
      // Mock deleteObject to reject with storage/unauthorized
      const storageError = new Error('Permission denied');
      storageError.code = 'storage/unauthorized';
      deleteObject.mockRejectedValue(storageError);

      render(
        <RegionView
          region={mockRegion}
          setView={mockSetView}
          setActiveThread={mockSetActiveThread}
        />
      );

      // Open creation form
      await waitFor(() => {
        fireEvent.click(screen.getByText('New Thread'));
      });

      // Simulate uploading an image (this adds to sessionUploads)
      const uploadButton = screen.getByTestId('mock-image-uploader');
      fireEvent.click(uploadButton);

      // Click cancel
      const cancelButton = screen.getByText('Cancel');
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      // Verify deleteObject was called
      expect(deleteObject).toHaveBeenCalled();

      // The form should still close (non-critical cleanup)
      await waitFor(() => {
        expect(screen.queryByText('Post a New Topic')).not.toBeInTheDocument();
      });

      // Check for warning message about failed cleanup
      // This is the key assertion - currently fails because no UI feedback is given
      await waitFor(() => {
        expect(screen.getByText(/failed to cleanup/i)).toBeInTheDocument();
      });
    });

    it('allows thread creation form to close even when cleanup fails', async () => {
      // Mock deleteObject to reject
      const storageError = new Error('Permission denied');
      storageError.code = 'storage/unauthorized';
      deleteObject.mockRejectedValue(storageError);

      render(
        <RegionView
          region={mockRegion}
          setView={mockSetView}
          setActiveThread={mockSetActiveThread}
        />
      );

      // Open creation form
      await waitFor(() => {
        fireEvent.click(screen.getByText('New Thread'));
      });

      // Upload an image
      fireEvent.click(screen.getByTestId('mock-image-uploader'));

      // Cancel
      await act(async () => {
        fireEvent.click(screen.getByText('Cancel'));
      });

      // Form should close regardless of cleanup failure
      await waitFor(() => {
        expect(screen.queryByText('Post a New Topic')).not.toBeInTheDocument();
      });
    });

    it('successfully cleans up uploaded images when cancel succeeds', async () => {
      // Mock successful deletion
      deleteObject.mockResolvedValue({});

      render(
        <RegionView
          region={mockRegion}
          setView={mockSetView}
          setActiveThread={mockSetActiveThread}
        />
      );

      // Open creation form
      await waitFor(() => {
        fireEvent.click(screen.getByText('New Thread'));
      });

      // Upload an image
      fireEvent.click(screen.getByTestId('mock-image-uploader'));

      // Cancel
      await act(async () => {
        fireEvent.click(screen.getByText('Cancel'));
      });

      // Verify cleanup was attempted
      expect(deleteObject).toHaveBeenCalled();

      // Form should close
      await waitFor(() => {
        expect(screen.queryByText('Post a New Topic')).not.toBeInTheDocument();
      });
    });
  });
});
