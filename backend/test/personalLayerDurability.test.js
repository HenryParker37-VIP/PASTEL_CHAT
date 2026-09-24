const assert = require('assert');
process.env.MONGODB_URI = 'mongodb://local.invalid/pastelchat';
process.env.NODE_ENV = 'test';

const documents = new Map();
const personalCollection = {
  async findOne(filter) { return documents.get(filter._id) ? structuredClone(documents.get(filter._id)) : null; },
  async updateOne(filter, update, options = {}) {
    const current = documents.get(filter._id);
    if (current) {
      const matches = typeof filter.revision === 'number' ? current.revision === filter.revision : filter.revision?.$exists === false ? current.revision == null : true;
      if (!matches) return { matchedCount: 0, upsertedCount: 0 };
      documents.set(filter._id, { ...current, ...structuredClone(update.$set) });
      return { matchedCount: 1, upsertedCount: 0 };
    }
    if (!options.upsert) return { matchedCount: 0, upsertedCount: 0 };
    documents.set(filter._id, { _id: filter._id, ...structuredClone(update.$set) });
    return { matchedCount: 0, upsertedCount: 1 };
  },
  find() { return { toArray: async () => [...documents.values()].map(structuredClone) }; }
};
const claims = new Map();
const claimCollection = {
  async createIndex() { return 'expiresAt_1'; },
  async findOne(filter) {
    return [...claims.values()].find(doc => doc.userId === filter.userId && doc.characterId === filter.characterId && doc.claimedAt >= filter.claimedAt.$gte) || null;
  },
  async countDocuments(filter) {
    return [...claims.values()].filter(doc => doc.userId === filter.userId && doc.characterId === filter.characterId && doc.claimedAt >= filter.claimedAt.$gte).length;
  },
  async updateOne(filter, update) {
    if (claims.has(filter._id)) return { upsertedCount: 0, modifiedCount: 0 };
    claims.set(filter._id, { _id: filter._id, ...update.$set });
    return { upsertedCount: 1, modifiedCount: 0 };
  }
};
let lastSnapshot = null;
let snapshotWrites = 0;
const stateCollection = { aggregate() { return { toArray: async () => [] }; }, async findOne() { return null; }, async updateOne(_filter, update) { lastSnapshot = structuredClone(update.$set.data); snapshotWrites += 1; return { matchedCount: 1 }; } };
global.__pastelMongoClient = {};
global.__pastelMongoDb = { collection(name) { return name === 'pastelchat_personal_layers' ? personalCollection : name === 'pastelchat_proactive_claims' ? claimCollection : stateCollection; } };
const storeDb = require('../src/db/store');

async function run() {
  await storeDb.ready;
  const prefix = `durable-personal-${Date.now()}`;
  const alice = `${prefix}-alice`;
  const bob = `${prefix}-bob`;
  const a = storeDb.addAIMemory({ userId: alice, key: 'city', value: 'Hanoi', sourceMessageAt: '2026-09-24T10:00:00.000Z' });
  const b = storeDb.addAIMemory({ userId: bob, key: 'city', value: 'Paris', sourceMessageAt: '2026-09-24T10:00:00.000Z' });
  storeDb.updateAIRelationship(alice, { time_zone: 'Asia/Ho_Chi_Minh', interaction_count: 1 });
  storeDb.updateAIRelationship(bob, { time_zone: 'Europe/Paris', interaction_count: 1 });
  await Promise.all([storeDb.flushAIPersonalLayer(alice), storeDb.flushAIPersonalLayer(bob)]);
  assert.strictEqual(documents.size, 2);
  storeDb.store.aiMemories = storeDb.store.aiMemories.filter(item => item.userId !== alice && item.userId !== bob);
  storeDb.store.aiRelationshipState = storeDb.store.aiRelationshipState.filter(item => item.userId !== alice && item.userId !== bob);
  await storeDb.hydrateAIPersonalLayer(alice);
  assert.deepStrictEqual(storeDb.getAIMemories(alice).map(item => item.value), ['Hanoi']);
  assert.strictEqual(storeDb.getAIMemories(bob).length, 0);
  await storeDb.hydrateAIPersonalLayer(bob);
  assert.deepStrictEqual(storeDb.getAIMemories(bob).map(item => item.value), ['Paris']);
  assert.strictEqual(storeDb.getAIRelationship(alice).time_zone, 'Asia/Ho_Chi_Minh');

  storeDb.addAIMemory({ userId: alice, key: 'city', value: 'Da Nang', sourceMessageAt: '2026-09-25T10:00:00.000Z' });
  await storeDb.flushAIPersonalLayer(alice);
  storeDb.addAIMemory({ userId: alice, key: 'city', value: 'Outdated', sourceMessageAt: '2026-09-23T10:00:00.000Z' });
  await storeDb.flushAIPersonalLayer(alice);
  storeDb.store.aiMemories = storeDb.store.aiMemories.filter(item => item.userId !== alice);
  await storeDb.hydrateAIPersonalLayer(alice);
  assert.deepStrictEqual(storeDb.getAIMemories(alice).map(item => item.value), ['Da Nang']);
  assert.deepStrictEqual(storeDb.getAIMemories(bob).map(item => item.value), ['Paris']);
  assert(!JSON.stringify([...documents.values()]).includes('data:image'));
  assert(Buffer.byteLength(JSON.stringify([...documents.values()])) < 10_000);
  const corrected = storeDb.getAIMemories(alice)[0];
  storeDb.deleteAIMemory(corrected._id, alice);
  await storeDb.flushAIPersonalLayer(alice, 'char_lyra', { deletedMemoryIds: [corrected._id] });
  assert.strictEqual(documents.get(JSON.stringify([alice, 'char_lyra'])).memories.length, 0);
  assert.strictEqual(documents.get(JSON.stringify([bob, 'char_lyra'])).memories[0]._id, b._id);
  storeDb.updateAIRelationship(alice, { shared_history: [{ userMessageId: 'old-turn' }], interaction_count: 3 });
  await storeDb.flushAIPersonalLayer(alice);
  storeDb.updateAIRelationship(alice, { shared_history: [], interaction_count: 0 });
  await storeDb.flushAIPersonalLayer(alice, 'char_lyra', { resetRelationship: true });
  assert.deepStrictEqual(documents.get(JSON.stringify([alice, 'char_lyra'])).relationship.shared_history, []);
  assert.strictEqual(documents.get(JSON.stringify([alice, 'char_lyra'])).relationship.interaction_count, 0);
  storeDb.persist();
  await storeDb.flushPersist();
  assert(!lastSnapshot.aiMemories.some(item => item.userId === alice || item.userId === bob), 'New personal rows must not grow pastelchat_state');
  assert.strictEqual(await storeDb.claimAIProactiveWindow(alice, 'char_lyra', '2026-09-25:morning'), true);
  assert.strictEqual(await storeDb.claimAIProactiveWindow(alice, 'char_lyra', '2026-09-25:morning'), false);
  assert.strictEqual(await storeDb.claimAIProactiveWindow(alice, 'char_lyra', '2026-09-25:afternoon'), false);
  process.env.WRITE_MODE = 'read-only';
  assert.strictEqual(await storeDb.claimAIProactiveWindow(bob, 'char_lyra', '2026-09-25:morning'), false);
  const writesBeforeReadOnly = snapshotWrites;
  storeDb.persist();
  await storeDb.flushPersist();
  assert.strictEqual(snapshotWrites, writesBeforeReadOnly, 'Read-only mode must not update the Atlas snapshot');
  delete process.env.WRITE_MODE;
  assert(a._id);
  console.log('Personal layer durable collection: two isolated users, rehydration, correction, deletion, compact storage PASS');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
