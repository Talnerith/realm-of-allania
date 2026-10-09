import { renderHook, act, waitFor } from '@testing-library/react';
import useCharacterLocations from '@/hooks/useCharacterLocations';
import { useGame } from '@/context/GameContext';
import * as firestore from 'firebase/firestore';

jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore');

const ts = (ms) => ({ toMillis: () => ms });
const T0 = 1_000_000;

// Aldric (c1) posted in t1 (someone replied after him), t2 (he posted last)
// and t3 (legacy thread without lastPostCharacterId, a reply came later)
const MY_POSTS = [
  { threadId: 't1', createdAt: ts(T0) },
  { threadId: 't2', createdAt: ts(T0 + 5000) },
  { threadId: 't3', createdAt: ts(T0 + 100) },
];
const THREADS = {
  t1: { title: 'Smoke over the Ember Road', regionId: '125', lastPostCharacterId: 'c-lyra', lastPostAt: ts(T0 + 60000), updatedAt: ts(T0 + 60000) },
  t2: { title: 'Council at Emberfall Keep', regionId: '166', lastPostCharacterId: 'c1', lastPostAt: ts(T0 + 5000), updatedAt: ts(T0 + 5000) },
  t3: { title: 'The Night Watch', regionId: '125', updatedAt: ts(T0 + 900000) },
};
const UNREAD = {
  t1: [{ id: 'p9', userId: 'u2', characterName: 'Lyra Moonwhisper', content: '*She* listened.', createdAt: ts(T0 + 60000) }],
  t2: [], t3: [{ id: 'p8', userId: 'u1', characterName: 'Aldric Vane', content: 'Mine', createdAt: ts(T0 + 900000) }],
};

describe('useCharacterLocations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGame.mockReturnValue({ user: { uid: 'u1' }, readReceipts: { t2: T0 + 9999 } });
    firestore.collection.mockImplementation((_, ...path) => ({ path: path.join('/') }));
    firestore.doc.mockImplementation((_, ...path) => ({ path: path.join('/'), id: path[path.length - 1] }));
    firestore.where.mockImplementation((field, op, value) => ({ field, op, value }));
    firestore.query.mockImplementation((ref, ...cs) => ({ ...ref, cs }));
    firestore.Timestamp = { fromMillis: (ms) => ts(ms) };
    firestore.onSnapshot.mockImplementation((ref, cb) => {
      if (ref.path.endsWith('/posts')) cb({ docs: MY_POSTS.map((p, i) => ({ id: `m${i}`, data: () => p })) });
      else cb({ exists: () => true, data: () => THREADS[ref.id] });
      return jest.fn();
    });
    firestore.getDocs.mockImplementation(async (q) => {
      const id = q.cs.find(c => c.field === 'threadId').value;
      return { docs: UNREAD[id].map(p => ({ id: p.id, data: () => p })) };
    });
    firestore.setDoc.mockResolvedValue();
    firestore.serverTimestamp.mockReturnValue('now');
  });

  it('lists the character\'s threads, most recent first, with whose turn it is', async () => {
    const { result } = renderHook(() => useCharacterLocations('c1'));
    await waitFor(() => expect(result.current.locations).toHaveLength(3));
    const byId = Object.fromEntries(result.current.locations.map(l => [l.id, l]));
    expect(result.current.locations.map(l => l.id)).toEqual(['t2', 't3', 't1']);
    expect(byId.t1).toEqual(expect.objectContaining({ yourTurn: true, status: 'Your turn', title: 'Smoke over the Ember Road' }));
    expect(byId.t2).toEqual(expect.objectContaining({ yourTurn: false, status: 'Waiting on others' }));
    // Legacy thread: updated well after the character's last post
    expect(byId.t3.yourTurn).toBe(true);
  });

  it('counts unread posts by others and builds the activity feed', async () => {
    const { result } = renderHook(() => useCharacterLocations('c1'));
    await waitFor(() => expect(result.current.activity).toHaveLength(1));
    expect(result.current.activity[0]).toEqual(expect.objectContaining({ by: 'Lyra Moonwhisper', threadId: 't1', threadTitle: 'Smoke over the Ember Road' }));
    const t1 = result.current.locations.find(l => l.id === 't1');
    expect(t1.unread).toBe(1);
    // Own posts never count as unread, and read threads aren't queried
    expect(result.current.locations.find(l => l.id === 't3').unread).toBe(0);
    const queried = firestore.getDocs.mock.calls.map(([q]) => q.cs.find(c => c && c.field === 'threadId').value);
    expect(queried.sort()).toEqual(['t1', 't3']);
  });

  it('mark all read writes read receipts for threads with unread posts', async () => {
    const { result } = renderHook(() => useCharacterLocations('c1'));
    await waitFor(() => expect(result.current.activity).toHaveLength(1));
    await act(async () => { await result.current.markAllRead(); });
    expect(firestore.setDoc).toHaveBeenCalledWith({ path: 'artifacts/realm-of-allania-v2/users/u1/readReceipts/t1', id: 't1' }, { lastRead: 'now' });
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    expect(result.current.activity).toHaveLength(0);
  });

  it('does nothing without a character', () => {
    const { result } = renderHook(() => useCharacterLocations(null));
    expect(result.current.locations).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });
});
