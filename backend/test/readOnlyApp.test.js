const assert = require('assert');
process.env.WRITE_MODE = 'read-only';
process.env.VERCEL = '1';
process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
const { app, server } = require('../src/app');
const storeDb = require('../src/db/store');

async function run() {
  await storeDb.ready;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/messages', '/ai/proactive/tick', '/ai/avatar']) {
      const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.strictEqual(response.status, 503);
      assert.strictEqual((await response.json()).status, 'read_only');
    }
    assert.strictEqual(process.env.WRITE_MODE, 'read-only');
  } finally {
    await new Promise(resolve => app.get('io').close(resolve));
  }
  console.log('Read-only HTTP application writes rejected before route handlers PASS');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
