import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ImageUploader from '../ImageUploader';
import { useGame } from '@/context/GameContext';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';

// Mocks
jest.mock('@/context/GameContext', () => ({
  useGame: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  storage: { app: {} }, // minimal mock
}));

jest.mock('@/lib/constants', () => ({
  APP_ID: 'test_app_id',
}));

describe('ImageUploader', () => {
  const mockUser = { uid: 'user123' };
  const mockOnImageChanged = jest.fn();

  beforeAll(() => {
    // Mock URL methods
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    // Mock Canvas methods on prototype
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
        drawImage: jest.fn(),
    }));
    HTMLCanvasElement.prototype.toBlob = jest.fn((cb) => cb(new Blob(['test'], { type: 'image/jpeg' })));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    useGame.mockReturnValue({ user: mockUser });
    ref.mockReturnValue('mockRef');
    uploadBytes.mockResolvedValue({});
    getDownloadURL.mockResolvedValue('https://example.com/new-image.jpg');
    deleteObject.mockResolvedValue({});
  });

  const setupFileMocks = () => {
    // Mock FileReader with async behavior
    const mockFileReaderInstance = {
      readAsDataURL: jest.fn(function() {
        setTimeout(() => {
             if (this.onload) {
                 this.onload({ target: { result: 'data:image/test' } });
             }
        }, 10);
      }),
    };
    jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReaderInstance);

    // Mock Image with async behavior
    global.Image = class {
      constructor() {
        this.width = 100;
        this.height = 100;
      }
      set src(val) {
        setTimeout(() => {
             if (this.onload) {
                 this.onload();
             }
        }, 10);
      }
    };
  };

  it('renders upload button', () => {
    render(<ImageUploader onImageChanged={mockOnImageChanged} />);
    expect(screen.getByText(/Upload File/i)).toBeInTheDocument();
  });

  it('handles file selection and upload', async () => {
    setupFileMocks();

    const { container } = render(<ImageUploader onImageChanged={mockOnImageChanged} />);
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['content'], 'test.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => expect(uploadBytes).toHaveBeenCalled());
    expect(getDownloadURL).toHaveBeenCalled();
    expect(mockOnImageChanged).toHaveBeenCalledWith('https://example.com/new-image.jpg', 'center');
  });

  it('cleans up intermediate upload when replaced', async () => {
    setupFileMocks();

    const { container } = render(<ImageUploader onImageChanged={mockOnImageChanged} />);
    let fileInput = container.querySelector('input[type="file"]');
    const file1 = new File(['content'], 'test1.png', { type: 'image/png' });
    const file2 = new File(['content'], 'test2.png', { type: 'image/png' });

    // Ensure getDownloadURL returns different URLs for sequential calls
    getDownloadURL
      .mockResolvedValueOnce('url1')
      .mockResolvedValueOnce('url2');

    // 1. Upload First Image
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file1] } });
    });

    await waitFor(() => expect(uploadBytes).toHaveBeenCalledTimes(1));
    expect(deleteObject).not.toHaveBeenCalled();

    // The component switches to 'preview' mode, removing the input.
    // We must click 'Upload File' to get the input back.
    const uploadTab = screen.getByText('Upload File');
    await act(async () => {
        fireEvent.click(uploadTab);
    });

    // Query the NEW input element
    fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    // 2. Upload Second Image
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file2] } });
    });

    await waitFor(() => expect(uploadBytes).toHaveBeenCalledTimes(2));

    // Verify Cleanup of 'url1'
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'url1');
  });

  it('does not delete initialUrl', async () => {
    setupFileMocks();

    getDownloadURL.mockResolvedValue('url-new');

    const { container } = render(<ImageUploader initialUrl="initial-existing-url" onImageChanged={mockOnImageChanged} />);
    const fileInput = container.querySelector('input[type="file"]');
    const file1 = new File(['content'], 'test1.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file1] } });
    });

    await waitFor(() => expect(uploadBytes).toHaveBeenCalled());

    // Should NOT delete initialUrl
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
