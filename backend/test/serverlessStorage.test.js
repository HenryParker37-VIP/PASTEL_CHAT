process.env.VERCEL = '1';
process.env.MONGODB_URI = '';
process.env.PASTELCHAT_DISABLE_PERSIST = '1';

const assert = require('assert');
const handler = require('../../api/index');

const response = {
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
};

handler({}, response)
  .then(() => {
    assert.strictEqual(response.statusCode, 503, 'Serverless traffic must fail closed without durable storage');
    assert.strictEqual(response.body?.storage, 'durable-storage-required');
    console.log('serverlessStorage.test.js: ephemeral Vercel storage is rejected');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
