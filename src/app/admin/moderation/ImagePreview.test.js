import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { httpsCallable } from 'firebase/functions';
import ImagePreview from './ImagePreview';

jest.mock('@/lib/firebase', () => ({ functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));

describe('ImagePreview', () => {
  const PATH = 'artifacts/realm-of-allania-v2/public/character_portraits/u1/a.png';
  let preview;

  beforeEach(() => {
    jest.clearAllMocks();
    preview = jest.fn();
    httpsCallable.mockReturnValue(preview);
  });

  it('loads the image only when asked, through the previewImage function', async () => {
    preview.mockResolvedValue({ data: { dataUrl: 'data:image/png;base64,AQID' } });
    render(<ImagePreview filePath={PATH} />);
    expect(preview).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Show image' })); });
    expect(httpsCallable).toHaveBeenCalledWith({}, 'previewImage');
    expect(preview).toHaveBeenCalledWith({ filePath: PATH });
    expect(screen.getByRole('img', { name: 'Image under review' })).toHaveAttribute('src', 'data:image/png;base64,AQID');
  });

  it('shows why an image could not be loaded and lets the moderator retry', async () => {
    preview.mockRejectedValue(new Error('This image no longer exists.'));
    render(<ImagePreview filePath={PATH} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Show image' })); });
    expect(screen.getByText('This image no longer exists.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show image' })).toBeEnabled();
  });
});
