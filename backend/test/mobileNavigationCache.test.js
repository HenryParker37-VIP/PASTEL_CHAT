/**
 * mobileNavigationCache.test.js
 * 
 * Verifies mobile viewport conversation persistence, instant avatar resolution,
 * and 10x repeated navigation cycles between Home and Lyra Chat.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for headless Node environment
const storageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.window = {
  innerWidth: 375, // iPhone / narrow mobile viewport
  localStorage: storageMock
};

const {
  setCachedConversation,
  getCachedConversation,
  getCachedAvatar,
  mergeMessages
} = await import('../../frontend/src/utils/conversationCache.js');

const {
  resolveCharacterAvatar,
  DEFAULT_LYRA_AVATAR
} = await import('../../frontend/src/utils/characterAvatar.js');

describe('Mobile Responsive Navigation & Cache Persistence (10x Cycles)', () => {
  const userId = 'user_henry_mobile_test';
  const friendId = 'user_ai_lyra';
  const customAvatar = 'https://custom-avatar.com/henry-lyra-custom.png';

  // Seed user with an existing customized avatar and conversation
  setCachedConversation(userId, friendId, {
    friend: {
      _id: friendId,
      name: 'Lyra',
      avatar: customAvatar,
      isAI: true,
      isOnline: true,
      status: 'Online'
    },
    resolvedAvatar: customAvatar,
    messages: [
      { _id: 'm1', senderId: { _id: userId, name: 'Henry' }, content: 'hey lyra!', createdAt: new Date(Date.now() - 60000).toISOString() },
      { _id: 'm2', senderId: { _id: friendId, name: 'Lyra', avatar: customAvatar }, content: 'hey henry! how is your day?', createdAt: new Date(Date.now() - 50000).toISOString() }
    ]
  });

  it('Mobile Header: Synchronously resolves customized avatar on initial render with friend=null', () => {
    // On mobile viewports, Header.js renders .mobile-chat-peer immediately using:
    // resolveCharacterAvatar({ friend, messages, friendId, userId })
    // Before API hydration, friend is null
    const instantMobileAvatar = resolveCharacterAvatar({
      friend: null,
      messages: [],
      friendId,
      userId
    });

    assert.equal(instantMobileAvatar, customAvatar, 'Mobile header must resolve custom avatar with 0ms delay');
    assert.notEqual(instantMobileAvatar, DEFAULT_LYRA_AVATAR, 'Mobile header must never flash default avatar');
  });

  it('Repeated 10x Navigation Cycles between Home and Lyra Chat', () => {
    let currentMessages = [
      { _id: 'm1', senderId: { _id: userId }, content: 'hey lyra!', createdAt: new Date(Date.now() - 60000).toISOString() },
      { _id: 'm2', senderId: { _id: friendId, avatar: customAvatar }, content: 'hey henry!', createdAt: new Date(Date.now() - 50000).toISOString() }
    ];

    for (let cycle = 1; cycle <= 10; cycle++) {
      // 1. User is on Lyra Chat -> Navigates to Home
      // On unmount, cache is intact in memory & storage
      const cachedAtHome = getCachedConversation(userId, friendId);
      assert.ok(cachedAtHome, `Cycle ${cycle}: Cache must persist when leaving chat`);
      assert.equal(cachedAtHome.messages.length, currentMessages.length);

      // 2. User navigates back to Lyra Chat (Mobile Viewport: 375px)
      // Chat.js initial state:
      const initialCache = getCachedConversation(userId, friendId);
      const instantMessages = initialCache?.messages || [];
      const instantFriend = initialCache?.friend || {
        _id: friendId,
        name: 'Lyra',
        isAI: true,
        isOnline: true,
        status: 'Online',
        avatar: getCachedAvatar(userId, friendId) || DEFAULT_LYRA_AVATAR
      };

      // VERIFY: Instant frame 0 render (0ms, no empty chat)
      assert.equal(instantMessages.length, currentMessages.length, `Cycle ${cycle}: Messages must be non-empty immediately`);
      assert.ok(instantMessages.length > 0, `Cycle ${cycle}: No empty-chat flash`);

      // VERIFY: Mobile Header .mobile-chat-peer avatar
      const mobileHeaderAvatar = resolveCharacterAvatar({
        friend: instantFriend,
        messages: instantMessages,
        friendId,
        userId
      });
      assert.equal(mobileHeaderAvatar, customAvatar, `Cycle ${cycle}: Mobile header must show custom avatar instantly`);
      assert.notEqual(mobileHeaderAvatar, DEFAULT_LYRA_AVATAR, `Cycle ${cycle}: No default-avatar flash on mobile`);

      // 3. User sends a new message during this cycle
      const newMessage = {
        _id: `m_${cycle}_new`,
        senderId: { _id: userId },
        content: `Cycle ${cycle} test message`,
        createdAt: new Date().toISOString()
      };
      currentMessages = [...currentMessages, newMessage];

      // Update cache
      setCachedConversation(userId, friendId, {
        friend: instantFriend,
        resolvedAvatar: customAvatar,
        messages: currentMessages
      });

      // 4. Background sync reconciliation simulation
      const serverPayload = [...currentMessages];
      const reconciled = mergeMessages(instantMessages, serverPayload, []);
      assert.equal(reconciled.length, currentMessages.length, `Cycle ${cycle}: Zero duplicates during background sync`);

      // Check sorting
      for (let i = 1; i < reconciled.length; i++) {
        const prevTime = new Date(reconciled[i - 1].createdAt).getTime();
        const currTime = new Date(reconciled[i].createdAt).getTime();
        assert.ok(prevTime <= currTime, `Cycle ${cycle}: Messages must remain chronologically sorted`);
      }
    }
  });

  it('Mobile safe: Unhydrated server friend profile never overwrites custom avatar', () => {
    // If backend returns friend object with default avatar placeholder before character update
    const unhydratedFriend = {
      _id: friendId,
      name: 'Lyra',
      avatar: DEFAULT_LYRA_AVATAR
    };

    const resolved = resolveCharacterAvatar({
      friend: unhydratedFriend,
      messages: [],
      friendId,
      userId
    });

    assert.equal(resolved, customAvatar, 'Custom avatar from cache must take priority over default avatar placeholder');
  });
});
