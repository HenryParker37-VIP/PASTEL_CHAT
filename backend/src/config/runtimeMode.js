function isPersistentService() {
  return process.env.PERSISTENT_SERVICE === 'true';
}

function isReadOnlyMode() {
  return process.env.APPLICATION_WRITES_DISABLED === 'true'
    || (isPersistentService() && process.env.WRITE_MODE !== 'enabled');
}

function assertSingleWriterConfiguration() {
  if (isPersistentService() && process.env.PERSISTENT_INSTANCE_COUNT !== '1') {
    throw new Error('Persistent service requires PERSISTENT_INSTANCE_COUNT=1 and fixed single-instance scaling');
  }
  if (isPersistentService() && process.env.WRITE_MODE === 'enabled'
    && process.env.SINGLE_WRITER_DEPLOYMENT_POLICY !== 'no-overlap') {
    throw new Error('Writable persistent service requires SINGLE_WRITER_DEPLOYMENT_POLICY=no-overlap');
  }
}

module.exports = { isPersistentService, isReadOnlyMode, assertSingleWriterConfiguration };
