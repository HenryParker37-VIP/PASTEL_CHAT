import {
  getCachedFriends,
  setCachedFriends,
  getCachedRequests,
  setCachedRequests,
  getCachedGroups,
  setCachedGroups,
  mergeFriends,
  prefetchFriends
} from './friendsCache';

describe('friendsCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('two-tier caching: getCachedFriends returns null when empty, and cached data after set', () => {
    const userId = 'u123';
    expect(getCachedFriends(userId)).toBeNull();

    const mockFriends = [
      { friendId: 'f1', customNickname: 'Bestie', realName: 'Alice', isOnline: true },
      { friendId: 'f2', customNickname: 'Lyra', realName: 'Lyra', isOnline: true }
    ];

    setCachedFriends(userId, mockFriends);
    const cached = getCachedFriends(userId);
    expect(cached).toHaveLength(2);
    expect(cached[0].customNickname).toBe('Bestie');

    // Verify localStorage persistence
    const stored = JSON.parse(localStorage.getItem(`pastel_chat_friends_v1:${userId}`));
    expect(stored).toHaveLength(2);
    expect(stored[0].friendId).toBe('f1');
  });

  test('requests and groups caching', () => {
    const userId = 'u456';
    expect(getCachedRequests(userId)).toBeNull();
    expect(getCachedGroups(userId)).toBeNull();

    setCachedRequests(userId, [{ _id: 'r1', fromId: 'u789' }]);
    setCachedGroups(userId, [{ _id: 'g1', name: 'Study Group' }]);

    expect(getCachedRequests(userId)).toHaveLength(1);
    expect(getCachedGroups(userId)).toHaveLength(1);
  });

  test('mergeFriends: preserves custom nicknames and resolves stably', () => {
    const cached = [
      { friendId: 'f1', customNickname: 'My Nickname', realName: 'Alice', isOnline: false, avatar: 'avatar1.png' },
      { friendId: 'f2', customNickname: 'Lyra', realName: 'Lyra', isOnline: false, avatar: 'avatar2.png' }
    ];

    // Server returns fresh online status, but customNickname might be empty or matching
    const server = [
      { friendId: 'f1', customNickname: '', realName: 'Alice', isOnline: true, avatar: 'avatar1.png' },
      { friendId: 'f2', customNickname: 'Lyra', realName: 'Lyra', isOnline: true, avatar: 'avatar2.png' },
      { friendId: 'f3', customNickname: 'Bob', realName: 'Bob', isOnline: false, avatar: 'avatar3.png' }
    ];

    const merged = mergeFriends(cached, server);
    expect(merged).toHaveLength(3);

    const f1 = merged.find((f) => f.friendId === 'f1');
    expect(f1.customNickname).toBe('My Nickname'); // Preserves custom nickname!
    expect(f1.isOnline).toBe(true); // Updated online presence!

    const f3 = merged.find((f) => f.friendId === 'f3');
    expect(f3.customNickname).toBe('Bob');
  });

  test('mergeFriends: safely removes deleted friends when server list does not include them', () => {
    const cached = [
      { friendId: 'f1', customNickname: 'Alice', realName: 'Alice' },
      { friendId: 'f2', customNickname: 'Bob', realName: 'Bob' }
    ];

    const server = [
      { friendId: 'f1', customNickname: 'Alice', realName: 'Alice' }
    ];

    const merged = mergeFriends(cached, server);
    expect(merged).toHaveLength(1);
    expect(merged[0].friendId).toBe('f1');
  });

  test('prefetchFriends: deduplicates in-flight calls and populates cache', async () => {
    const userId = 'uPrefetch';
    const mockFriends = [{ friendId: 'p1', customNickname: 'Pat' }];
    const mockRequests = [{ _id: 'req1' }];
    const mockGroups = [{ _id: 'grp1' }];

    const mockApi = {
      get: jest.fn().mockImplementation((url) => {
        if (url === '/friends') return Promise.resolve({ data: mockFriends });
        if (url === '/friends/requests') return Promise.resolve({ data: mockRequests });
        if (url === '/groups') return Promise.resolve({ data: mockGroups });
        return Promise.reject(new Error('Unknown url'));
      })
    };

    // Parallel calls should return the same promise
    const p1 = prefetchFriends(mockApi, userId, true);
    const p2 = prefetchFriends(mockApi, userId, false);

    const res = await Promise.all([p1, p2]);
    expect(res[0]).toEqual(res[1]);
    expect(mockApi.get).toHaveBeenCalledTimes(3);

    // Cache should now be populated
    expect(getCachedFriends(userId)).toHaveLength(1);
    expect(getCachedRequests(userId)).toHaveLength(1);
    expect(getCachedGroups(userId)).toHaveLength(1);
  });
});
