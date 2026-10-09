import { isValidDisplayName, authorName, displayNameProblem } from '@/lib/profiles';
import { formatStat } from '@/lib/siteStats';
import { canLikePost } from '@/lib/likes';

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore');

describe('isValidDisplayName', () => {
  it('accepts ordinary names', () => {
    expect(isValidDisplayName('Emberquill')).toBe(true);
    expect(isValidDisplayName('Jo')).toBe(true);
  });

  it('rejects too short, too long, blocked and staff-looking names', () => {
    expect(isValidDisplayName('J')).toBe(false);
    expect(isValidDisplayName('x'.repeat(31))).toBe(false);
    expect(isValidDisplayName('Official Moderator')).toBe(false);
    expect(isValidDisplayName(undefined)).toBe(false);
  });
});

describe('displayNameProblem', () => {
  it('accepts ordinary names', () => {
    expect(displayNameProblem('Emberquill')).toBeNull();
  });

  it('explains what is wrong with a bad name', () => {
    expect(displayNameProblem(' J ')).toMatch(/at least 2/);
    expect(displayNameProblem('x'.repeat(31))).toMatch(/at most 30/);
    expect(displayNameProblem('Official Moderator')).toMatch(/site staff/);
    expect(displayNameProblem('Official Moderator', { allowReserved: true })).toBeNull();
  });
});

describe('authorName', () => {
  it('falls back when there is no profile', () => {
    expect(authorName({ displayName: 'Emberquill' })).toBe('Emberquill');
    expect(authorName(null)).toBe('Unknown author');
  });
});

describe('formatStat', () => {
  it('formats counts for the Landing page', () => {
    expect(formatStat(12)).toBe('12');
    expect(formatStat(1234)).toBe('1,234');
    expect(formatStat(15382)).toBe('15,000+');
    expect(formatStat(undefined)).toBe('—');
  });
});

describe('canLikePost', () => {
  const post = { userId: 'a', status: 'approved' };
  it('allows other players on approved posts only', () => {
    expect(canLikePost(post, { uid: 'b' })).toBe(true);
    expect(canLikePost(post, { uid: 'a' })).toBe(false);
    expect(canLikePost({ ...post, status: 'pending' }, { uid: 'b' })).toBe(false);
    expect(canLikePost({ userId: 'a' }, { uid: 'b' })).toBe(true); // legacy posts without status
    expect(canLikePost(post, null)).toBe(false);
  });
});
