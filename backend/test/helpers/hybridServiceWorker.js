const db = require('../../src/db/store');
const { app, server } = require('../../src/app');
const { createUserToken } = require('../../src/services/sessionAuth');
const http = require('node:http');

async function start() {
  await db.ready;
  let fixture = null;
  if (process.env.HYBRID_TEST_WRITER === 'true') {
    const tag = `hybrid-${Date.now()}`;
    const users = ['A', 'B', 'C'].map(letter => db.createUser({ name: `${tag}-${letter}`, loginCode: `${letter}AAA-BBBB` }));
    db.addFriend(users[0]._id, users[1]._id);
    db.addFriend(users[1]._id, users[0]._id);
    fixture = { users: users.map(user => ({ id: user._id, token: createUserToken(user) })) };
    await db.flushPersist();
    const vercelHandler = require('../../../api/index');
    const writerServer = http.createServer(vercelHandler);
    await new Promise(resolve => writerServer.listen(Number(process.env.PORT), '127.0.0.1', resolve));
  } else {
    await new Promise(resolve => server.once('listening', resolve));
  }
  process.send?.({ type: 'ready', fixture });
}

start().catch(error => {
  process.send?.({ type: 'error', message: error.message });
  process.exitCode = 1;
});
