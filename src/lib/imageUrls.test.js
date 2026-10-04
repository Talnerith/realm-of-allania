jest.mock('@/lib/firebase', () => ({ functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));

import { httpsCallable } from 'firebase/functions';
import { isHostedImageUrl, hostedImageUrl, importImageFromUrl } from './imageUrls';

const BUCKET = 'realm-test.appspot.com';

describe('isHostedImageUrl', () => {
  const originalBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  beforeEach(() => { process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = BUCKET; });
  afterAll(() => { process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = originalBucket; });

  it('accepts this project\'s Storage URLs and the site\'s own assets', () => {
    expect(isHostedImageUrl(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/a.jpg?alt=media`)).toBe(true);
    expect(isHostedImageUrl('/map.webp')).toBe(true);
  });

  it('rejects external hosts, other buckets and odd schemes', () => {
    expect(isHostedImageUrl('https://evil.example/tracker.png')).toBe(false);
    expect(isHostedImageUrl('https://firebasestorage.googleapis.com/v0/b/other-bucket/o/a.jpg')).toBe(false);
    expect(isHostedImageUrl('//evil.example/a.png')).toBe(false);
    expect(isHostedImageUrl('javascript:alert(1)')).toBe(false);
    expect(isHostedImageUrl('')).toBe(false);
    expect(isHostedImageUrl(undefined)).toBe(false);
  });

  it('hostedImageUrl blanks anything not hosted', () => {
    expect(hostedImageUrl('https://evil.example/a.png')).toBe('');
    expect(hostedImageUrl('/map.webp')).toBe('/map.webp');
  });
});

describe('importImageFromUrl', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the hosted URL from the callable', async () => {
    const call = jest.fn().mockResolvedValue({ data: { url: 'https://firebasestorage.googleapis.com/v0/b/x/o/y' } });
    httpsCallable.mockReturnValue(call);

    await expect(importImageFromUrl('https://example.com/a.png', 'uploads'))
      .resolves.toBe('https://firebasestorage.googleapis.com/v0/b/x/o/y');
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'importImageFromUrl');
    expect(call).toHaveBeenCalledWith({ url: 'https://example.com/a.png', folder: 'uploads' });
  });

  it('surfaces the server\'s message on failure', async () => {
    httpsCallable.mockReturnValue(jest.fn().mockRejectedValue(new Error('Images must be under 5 MB.')));
    await expect(importImageFromUrl('https://example.com/big.png', 'uploads')).rejects.toThrow('Images must be under 5 MB.');
  });
});
