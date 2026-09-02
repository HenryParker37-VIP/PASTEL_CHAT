const assert = require('assert');
const db = require('../src/db/store');

async function run() {
  await db.ready;
  const originalReleases = db.store.releases;
  const originalNotifications = db.store.notifications;
  const originalUsers = db.store.users;
  const testUsers = [
    { _id: 'release-test-user-a', name: 'Release Test A' },
    { _id: 'release-test-user-b', name: 'Release Test B' }
  ];
  try {
    db.store.releases = [];
    db.store.notifications = [];
    db.store.users = testUsers;
    const release = db.createRelease({
      version: '9.9.9-test', title: 'Test release', summary: 'Test summary',
      features: ['Feature'], fixes: ['Fix'], improvements: ['Improvement']
    });
    assert.strictEqual(db.createRelease({ version: '9.9.9-test', title: 'Duplicate' })._id, release._id, 'release creation is idempotent');
    assert.strictEqual(db.store.releases.length, 1, 'duplicate release is not stored');
    assert.strictEqual(db.notifyUsersOfRelease(release), 2, 'one notification is created for each user');
    assert.strictEqual(db.notifyUsersOfRelease(release), 0, 'duplicate notification fan-out is prevented');
    assert.strictEqual(db.hasSeenRelease(testUsers[0]._id, release.version), false, 'release starts unseen');
    db.markReleaseSeen(testUsers[0]._id, release.version);
    assert.strictEqual(db.hasSeenRelease(testUsers[0]._id, release.version), true, 'release seen state is persisted on user');
    assert.strictEqual(db.hasSeenRelease(testUsers[1]._id, release.version), false, 'seen state remains per user');
    console.log('Release tests: 6 passed, 0 failed');
  } finally {
    db.store.releases = originalReleases;
    db.store.notifications = originalNotifications;
    db.store.users = originalUsers;
    db.persist();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
