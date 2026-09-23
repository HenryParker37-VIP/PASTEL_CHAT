const assert = require('assert');

async function runTests() {
  console.log('🧪 Starting Character Avatar Resolution Test Suite...\n');

  const { resolveCharacterAvatar, DEFAULT_LYRA_AVATAR } = await import('../../frontend/src/utils/characterAvatar.js');

  const CUSTOM_AVATAR_1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const CUSTOM_AVATAR_2 = 'https://example.com/custom-lyra-photo.jpg';

  // Test 1: Resolves live custom avatar from friend object (Chat Header & Profile card)
  console.log('Test 1: Resolves live custom avatar from friend object');
  const avatarFromFriend = resolveCharacterAvatar({
    friend: { _id: 'user_ai_lyra', name: 'Lyra', avatar: CUSTOM_AVATAR_1, isAI: true },
    friendId: 'user_ai_lyra'
  });
  assert.strictEqual(avatarFromFriend, CUSTOM_AVATAR_1, 'Must return friend.avatar when set');
  console.log('  ✅ Live custom avatar from friend object verified');

  // Test 2: Resolves from message sender object (MessageItem)
  console.log('\nTest 2: Resolves from message sender object');
  const avatarFromSender = resolveCharacterAvatar({
    friend: null,
    sender: { _id: 'user_ai_lyra', name: 'Lyra', avatar: CUSTOM_AVATAR_1, isAI: true },
    friendId: 'user_ai_lyra'
  });
  assert.strictEqual(avatarFromSender, CUSTOM_AVATAR_1, 'Must return sender.avatar when friend is null');
  console.log('  ✅ Message sender avatar verified');

  // Test 3: Resolves from latest message in conversation history when friend has not loaded
  console.log('\nTest 3: Resolves from message history when friend is not yet populated');
  const messages = [
    { _id: 'msg-1', senderId: { _id: 'user_ai_lyra', avatar: CUSTOM_AVATAR_1 } },
    { _id: 'msg-2', senderId: 'user_human_1', content: 'hey' },
    { _id: 'msg-3', senderId: { _id: 'user_ai_lyra', avatar: CUSTOM_AVATAR_2 } }
  ];
  const avatarFromHistory = resolveCharacterAvatar({
    friend: null,
    sender: null,
    messages,
    friendId: 'user_ai_lyra'
  });
  assert.strictEqual(avatarFromHistory, CUSTOM_AVATAR_2, 'Must return the most recent avatar from history');
  console.log('  ✅ Message history avatar fallback verified');

  // Test 4: Dynamic update when user customizes avatar
  console.log('\nTest 4: Immediate dynamic update when user changes avatar');
  let currentFriend = { _id: 'user_ai_lyra', name: 'Lyra', avatar: CUSTOM_AVATAR_1, isAI: true };
  assert.strictEqual(resolveCharacterAvatar({ friend: currentFriend }), CUSTOM_AVATAR_1);

  // User changes avatar to CUSTOM_AVATAR_2
  currentFriend = { ...currentFriend, avatar: CUSTOM_AVATAR_2 };
  assert.strictEqual(
    resolveCharacterAvatar({ friend: currentFriend }),
    CUSTOM_AVATAR_2,
    'Immediately reflects updated avatar'
  );
  console.log('  ✅ Immediate dynamic update verified across all surfaces');

  // Test 5: Fallback to default Lyra avatar only when no custom avatar exists
  console.log('\nTest 5: Fallback to default character avatar when no custom avatar exists');
  const defaultLyra = resolveCharacterAvatar({
    friend: { _id: 'user_ai_lyra', name: 'Lyra', avatar: null, isAI: true },
    friendId: 'user_ai_lyra'
  });
  assert.strictEqual(defaultLyra, DEFAULT_LYRA_AVATAR, 'Must return DEFAULT_LYRA_AVATAR');
  console.log('  ✅ Default Lyra avatar fallback verified');

  // Test 6: Non-AI peer without avatar returns null (for letter initial)
  console.log('\nTest 6: Non-AI peer without avatar returns null');
  const humanWithoutAvatar = resolveCharacterAvatar({
    friend: { _id: 'user_human_2', name: 'Bob', avatar: null, isAI: false },
    friendId: 'user_human_2'
  });
  assert.strictEqual(humanWithoutAvatar, null, 'Human peer without avatar returns null');
  console.log('  ✅ Non-AI peer returns null for letter initial display');

  console.log('\n🎉 All Character Avatar Resolution tests passed successfully!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
