import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LikeButton from '@/components/Forum/LikeButton';
import * as firestore from 'firebase/firestore';

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore');

describe('LikeButton', () => {
  const post = { id: 'p1', userId: 'author', status: 'approved', likeCount: 4 };
  const user = { uid: 'reader' };
  let emit;

  beforeEach(() => {
    jest.clearAllMocks();
    firestore.doc.mockImplementation((_, ...path) => ({ path: path.join('/') }));
    firestore.onSnapshot.mockImplementation((ref, cb) => { emit = cb; cb({ exists: () => false }); return jest.fn(); });
    firestore.setDoc.mockResolvedValue();
    firestore.deleteDoc.mockResolvedValue();
    firestore.serverTimestamp.mockReturnValue('now');
  });

  it('likes a post with the player uid as the like id', async () => {
    render(<LikeButton post={post} user={user} />);
    const btn = screen.getByRole('button', { name: 'Like post, 4 likes' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await act(async () => { fireEvent.click(btn); });
    expect(firestore.setDoc).toHaveBeenCalledWith({ path: 'artifacts/realm-of-allania-v2/public/data/posts/p1/likes/reader' }, { createdAt: 'now' });
    // Shows the new count before the function updates likeCount
    expect(screen.getByRole('button', { name: 'Unlike post, 5 likes' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hands over to the server count once it changes', async () => {
    const { rerender } = render(<LikeButton post={post} user={user} />);
    await act(async () => { fireEvent.click(screen.getByRole('button')); });
    act(() => emit({ exists: () => true }));
    rerender(<LikeButton post={{ ...post, likeCount: 5 }} user={user} />);
    expect(screen.getByRole('button', { name: 'Unlike post, 5 likes' })).toBeInTheDocument();
  });

  it('unlikes by deleting the like', async () => {
    firestore.onSnapshot.mockImplementation((ref, cb) => { cb({ exists: () => true }); return jest.fn(); });
    render(<LikeButton post={post} user={user} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Unlike post, 4 likes' })); });
    expect(firestore.deleteDoc).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Like post, 3 likes' })).toBeInTheDocument();
  });

  it('reverts when the write is refused', async () => {
    firestore.setDoc.mockRejectedValue(new Error('denied'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<LikeButton post={post} user={user} />);
    await act(async () => { fireEvent.click(screen.getByRole('button')); });
    expect(screen.getByRole('button', { name: 'Like post, 4 likes' })).toHaveAttribute('aria-pressed', 'false');
    console.error.mockRestore();
  });

  it('cannot like your own post', () => {
    render(<LikeButton post={post} user={{ uid: 'author' }} />);
    const btn = screen.getByRole('button', { name: /4 likes/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', "You can't like your own post");
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });

  it('guests see the count but cannot like', () => {
    render(<LikeButton post={post} user={null} />);
    expect(screen.getByRole('button', { name: /4 likes/ })).toBeDisabled();
  });

  it('is hidden on unpublished posts', () => {
    const { container } = render(<LikeButton post={{ ...post, status: 'pending' }} user={user} />);
    expect(container).toBeEmptyDOMElement();
  });
});
