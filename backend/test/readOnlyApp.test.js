const assert = require('assert');
process.env.VERCEL = '1';
process.env.RENDER = 'true';
process.env.REALTIME_RELAY = 'false';
process.env.WRITE_MODE = 'write';
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
    const health = await fetch(base + '/health');
    const status = await health.json();
    assert.strictEqual(status.writeMode, 'read-only');
    assert.strictEqual(status.relayOnly, true);
    assert.strictEqual(status.singleWriterConfigured, true);
    assert.strictEqual(process.env.WRITE_MODE, 'write', 'Render must fail closed even if WRITE_MODE is misconfigured');
  } finally {
    await new Promise(resolve => app.get('io').close(resolve));
  }
  console.log('Read-only HTTP application writes rejected before route handlers PASS');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
