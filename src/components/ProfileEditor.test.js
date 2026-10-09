import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileEditor from '@/components/ProfileEditor';
import { deleteObject, ref } from 'firebase/storage';

jest.mock('@/lib/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({ ref: jest.fn((_, url) => ({ url })), deleteObject: jest.fn(() => Promise.resolve()) }));
// The uploader has its own tests; here it only reports a new picture
jest.mock('@/components/ImageUploader', () => function MockUploader({ initialUrl, onImageChanged }) {
  return (
    <div>
      <span data-testid="current">{initialUrl}</span>
      <button type="button" onClick={() => onImageChanged('https://s/o/x%2Fauthor_avatars%2Fu1%2Fnew.jpg', '50% 30%')}>Upload mock</button>
    </div>
  );
});

const OLD = 'https://s/o/x%2Fauthor_avatars%2Fu1%2Fold.jpg';
const NEW = 'https://s/o/x%2Fauthor_avatars%2Fu1%2Fnew.jpg';

const setup = (props = {}) => {
  const handlers = { onSaveName: jest.fn().mockResolvedValue(), onSaveAvatar: jest.fn().mockResolvedValue(), onClose: jest.fn() };
  render(<ProfileEditor name="Verif" avatar={{ url: OLD, position: 'center' }} {...handlers} {...props} />);
  return { ...handlers, ...props };
};

describe('ProfileEditor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves a new picture and deletes the old one', async () => {
    const h = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Upload mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.onClose).toHaveBeenCalled());
    expect(h.onSaveAvatar).toHaveBeenCalledWith(NEW, '50% 30%');
    expect(h.onSaveName).not.toHaveBeenCalled();
    expect(ref).toHaveBeenCalledWith({}, OLD);
    expect(deleteObject).toHaveBeenCalledTimes(1);
  });

  it('saves a new name only', async () => {
    const h = setup();
    fireEvent.change(screen.getByLabelText('Author name'), { target: { value: 'Talnerith' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.onClose).toHaveBeenCalled());
    expect(h.onSaveName).toHaveBeenCalledWith('Talnerith');
    expect(h.onSaveAvatar).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('removes the picture', async () => {
    const h = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remove picture' }));
    expect(screen.getByTestId('current')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.onSaveAvatar).toHaveBeenCalledWith('', 'center'));
    expect(ref).toHaveBeenCalledWith({}, OLD);
  });

  it('deletes an unsaved upload on cancel', () => {
    const h = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Upload mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(h.onClose).toHaveBeenCalled();
    expect(h.onSaveAvatar).not.toHaveBeenCalled();
    expect(ref).toHaveBeenCalledWith({}, NEW);
  });

  it('shows the error and stays open when saving fails', async () => {
    const h = setup({ onSaveName: jest.fn().mockRejectedValue(new Error('Names need at least 2 characters.')) });
    fireEvent.change(screen.getByLabelText('Author name'), { target: { value: 'J' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Names need at least 2 characters.');
    expect(h.onClose).not.toHaveBeenCalled();
  });

  it('never deletes a picture that is not an author upload', async () => {
    const h = setup({ avatar: { url: '/images/brand/crest.webp', position: 'center' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload mock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.onClose).toHaveBeenCalled());
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
