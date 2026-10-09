import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ImageUploader from '@/components/ImageUploader';
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

    // Mock Canvas methods on prototype; flatCanvas makes every pixel read back the same
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      drawImage: jest.fn(),
      getImageData: () => ({
        data: Uint8ClampedArray.from({ length: 16 * 16 * 4 }, (_, i) => (flatCanvas ? 0 : i % 256)),
      }),
    }));
    HTMLCanvasElement.prototype.toBlob = jest.fn((cb, type) => cb(new Blob(['test'], { type })));
  });

  let flatCanvas;
  let imageSize;
  beforeEach(() => {
    flatCanvas = false;
    imageSize = { width: 100, height: 100 };
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
      readAsDataURL: jest.fn(function () {
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
        this.width = imageSize.width;
        this.height = imageSize.height;
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

  describe('preparing the file', () => {
    const sized = (name, type, bytes) => {
      const file = new File(['content'], name, { type });
      Object.defineProperty(file, 'size', { value: bytes });
      return file;
    };
    const upload = async (file) => {
      setupFileMocks();
      const { container } = render(<ImageUploader onImageChanged={mockOnImageChanged} />);
      await act(async () => {
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
      });
    };
    const uploadedPath = () => ref.mock.calls.at(-1)[1];

    beforeEach(() => { jest.spyOn(window, 'alert').mockImplementation(() => {}); });

    it('uploads a small supported image untouched', async () => {
      const file = sized('portrait.png', 'image/png', 300 * 1024);
      await upload(file);
      await waitFor(() => expect(uploadBytes).toHaveBeenCalled());
      expect(uploadBytes).toHaveBeenCalledWith('mockRef', file, { contentType: 'image/png' });
      expect(uploadedPath()).toMatch(/\/user123\/[^/]+\.png$/);
      expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
    });

    it('resizes a large photo to JPEG', async () => {
      imageSize = { width: 4000, height: 3000 };
      const file = sized('photo.jpg', 'image/jpeg', 4 * 1024 * 1024);
      await upload(file);
      await waitFor(() => expect(uploadBytes).toHaveBeenCalled());
      const [, blob, meta] = uploadBytes.mock.calls[0];
      expect(blob).not.toBe(file);
      expect(meta).toEqual({ contentType: 'image/jpeg' });
      expect(uploadedPath()).toMatch(/\.jpg$/);
      const canvas = HTMLCanvasElement.prototype.toBlob.mock.contexts[0];
      expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
    });

    it('caps a tall image by its height and keeps transparency-capable formats out of JPEG', async () => {
      imageSize = { width: 1000, height: 8000 };
      await upload(sized('scroll.png', 'image/png', 3 * 1024 * 1024));
      await waitFor(() => expect(uploadBytes).toHaveBeenCalled());
      const canvas = HTMLCanvasElement.prototype.toBlob.mock.contexts[0];
      expect([canvas.width, canvas.height]).toEqual([200, 1600]);
      expect(uploadBytes.mock.calls[0][2]).toEqual({ contentType: 'image/webp' });
      expect(uploadedPath()).toMatch(/\.webp$/);
    });

    it('uploads the original when the resized canvas comes back as one flat colour', async () => {
      flatCanvas = true;
      const file = sized('portrait.png', 'image/png', 3 * 1024 * 1024);
      await upload(file);
      await waitFor(() => expect(uploadBytes).toHaveBeenCalled());
      expect(uploadBytes).toHaveBeenCalledWith('mockRef', file, { contentType: 'image/png' });
      expect(uploadedPath()).toMatch(/\.png$/);
    });

    it('explains a blank canvas when the original is too big to send', async () => {
      flatCanvas = true;
      await upload(sized('huge.png', 'image/png', 6 * 1024 * 1024));
      await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/wouldn't let us resize.*under 5 MB.*by link/)));
      expect(uploadBytes).not.toHaveBeenCalled();
    });
  });

  describe('unsupported formats', () => {
    // The browser can't decode the file, so the Image errors instead of loading
    const setupUndecodable = () => {
      setupFileMocks();
      global.Image = class {
        set src(val) { setTimeout(() => this.onerror && this.onerror(), 10); }
      };
    };

    beforeEach(() => { jest.spyOn(window, 'alert').mockImplementation(() => {}); });

    const choose = async (container, file) => {
      await act(async () => {
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
      });
      await waitFor(() => expect(window.alert).toHaveBeenCalled());
    };

    it('explains that iPhone HEIC photos are not supported', async () => {
      setupUndecodable();
      const { container } = render(<ImageUploader onImageChanged={mockOnImageChanged} />);
      await choose(container, new File(['content'], 'IMG_0042.HEIC', { type: 'image/heic' }));
      expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/iPhone photos \(HEIC\).*JPG, PNG, GIF or WebP/));
      expect(uploadBytes).not.toHaveBeenCalled();
      expect(mockOnImageChanged).not.toHaveBeenCalled();
    });

    it('names the supported formats for any other undecodable image', async () => {
      setupUndecodable();
      const { container } = render(<ImageUploader onImageChanged={mockOnImageChanged} />);
      await choose(container, new File(['content'], 'scan.tiff', { type: 'image/tiff' }));
      expect(window.alert).toHaveBeenCalledWith("This file format isn't supported. Please choose a JPG, PNG, GIF or WebP image.");
    });

    it('rejects a file that is not an image without reading it', async () => {
      setupFileMocks();
      const { container } = render(<ImageUploader onImageChanged={mockOnImageChanged} />);
      await choose(container, new File(['content'], 'notes.pdf', { type: 'application/pdf' }));
      expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/isn't supported/));
      expect(window.FileReader).not.toHaveBeenCalled();
    });

    it('keeps the previous upload when the new file cannot be read', async () => {
      setupFileMocks();
      getDownloadURL.mockResolvedValueOnce('url1');
      const { container } = render(<ImageUploader onImageChanged={mockOnImageChanged} />);
      await act(async () => {
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['c'], 'a.png', { type: 'image/png' })] } });
      });
      await waitFor(() => expect(uploadBytes).toHaveBeenCalledTimes(1));

      await act(async () => { fireEvent.click(screen.getByText('Upload File')); });
      setupUndecodable();
      await choose(container, new File(['c'], 'b.heic', { type: 'image/heic' }));
      expect(deleteObject).not.toHaveBeenCalled();
      expect(uploadBytes).toHaveBeenCalledTimes(1);
    });
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
