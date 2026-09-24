function isPersistentService() {
  return process.env.PERSISTENT_SERVICE === 'true';
}

function isReadOnlyMode() {
  return process.env.APPLICATION_WRITES_DISABLED === 'true'
    || (isPersistentService() && process.env.WRITE_MODE !== 'enabled');
}

function assertSingleWriterConfiguration() {
  if (isPersistentService() && process.env.KOYEB_INSTANCE_COUNT !== '1') {
    throw new Error('Persistent service requires KOYEB_INSTANCE_COUNT=1 and fixed single-instance Koyeb scaling');
  }
  if (isPersistentService() && process.env.WRITE_MODE === 'enabled'
    && process.env.KOYEB_DEPLOYMENT_STRATEGY !== 'immediate') {
    throw new Error('Writable Koyeb service requires KOYEB_DEPLOYMENT_STRATEGY=immediate to prevent overlapping deployments');
  }
}

module.exports = { isPersistentService, isReadOnlyMode, assertSingleWriterConfiguration };
