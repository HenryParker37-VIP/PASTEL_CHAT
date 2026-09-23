process.env.MONGODB_URI = '';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';

const assert = require('assert');
const {
  createUser,
  searchUsers,
  createRequest,
  getRequests,
  addFriend,
  removeRequest,
  getFriends
} = require('../src/db/store');

const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const accountA = createUser({ name: `FriendFlowA${suffix}`, loginCode: `A${suffix}` });
const accountB = createUser({ name: `HenryParker${suffix}`, loginCode: `B${suffix}` });
const accountC = createUser({ name: `FriendFlowC${suffix}`, loginCode: `C${suffix}` });
const accountD = createUser({ name: `FriendFlowD${suffix}`, loginCode: `D${suffix}` });

const findB = (query) => searchUsers(query, accountA._id).find((user) => user._id === accountB._id);
for (const query of [accountB.name, accountB.name.toLowerCase(), accountB.name.toUpperCase(), accountB.name.slice(0, 5), `  ${accountB.name}  `]) {
  assert.ok(findB(query), `Expected search to find account B for ${query}`);
}

const discovery = findB(accountB.name);
assert.deepStrictEqual(Object.keys(discovery).sort(), ['_id', 'avatar', 'isOnline', 'name', 'relationship']);
assert.deepStrictEqual(discovery.relationship, { status: 'none' });
assert.ok(!searchUsers(accountA.name, accountA._id).some((user) => user._id === accountA._id), 'Search must exclude the current user');

const request = createRequest(accountA._id, accountB._id);
assert.ok(request?._id, 'Request must be created');
assert.strictEqual(createRequest(accountA._id, accountB._id)._id, request._id, 'Duplicate outgoing requests must be idempotent');
assert.ok(getRequests(accountB._id).some((item) => item._id === request._id && item.name === accountA.name), 'Receiver must see its incoming request');
assert.deepStrictEqual(findB(accountB.name).relationship, { status: 'outgoing', requestId: request._id });
assert.deepStrictEqual(searchUsers(accountA.name, accountB._id).find((user) => user._id === accountA._id).relationship, { status: 'incoming', requestId: request._id });

addFriend(accountA._id, accountB._id, accountB.name);
addFriend(accountB._id, accountA._id, accountA.name);
removeRequest(request._id);
assert.ok(getFriends(accountA._id).some((friend) => friend.friendId === accountB._id), 'Sender must retain friendship after acceptance');
assert.ok(getFriends(accountB._id).some((friend) => friend.friendId === accountA._id), 'Receiver must retain friendship after acceptance');
assert.deepStrictEqual(findB(accountB.name).relationship, { status: 'friends' });

const rejectedRequest = createRequest(accountC._id, accountD._id);
assert.ok(getRequests(accountD._id).some((item) => item._id === rejectedRequest._id), 'Receiver must see a request before declining');
removeRequest(rejectedRequest._id);
assert.ok(!getRequests(accountD._id).some((item) => item._id === rejectedRequest._id), 'Declined requests must disappear');

console.log('friendshipFlow.test.js: search, request, accept, duplicate, and decline flows passed');
