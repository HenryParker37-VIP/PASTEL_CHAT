function closeServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
      else resolve();
    });
  });
}

function closeSocketServer(io) {
  if (!io || typeof io.close !== 'function') return Promise.resolve();
  return new Promise((resolve, reject) => {
    try {
      io.close((error) => error ? reject(error) : resolve());
    } catch (error) {
      reject(error);
    }
  });
}

function installGracefulShutdown({ server, io, storeDb, processRef = process, timeoutMs = 15000, logger = console }) {
  let shutdownPromise = null;
  const shutdown = (signal) => {
    if (shutdownPromise) return shutdownPromise;
    logger.info(`[PastelChat] ${signal} received; draining HTTP and Socket.IO`);

    let timeoutHandle;
    let resolveTimeout;
    const timeoutPromise = new Promise((resolve) => { resolveTimeout = resolve; });
    timeoutHandle = setTimeout(() => {
      logger.error('[PastelChat] Shutdown deadline reached before durable flush completed');
      processRef.exit(1);
      resolveTimeout();
    }, timeoutMs);

    const stopAccepting = closeServer(server);
    const closeSockets = closeSocketServer(io);
    const finish = Promise.all([stopAccepting, closeSockets])
      .then(() => storeDb.closeDurableStore ? storeDb.closeDurableStore() : storeDb.flushPersist())
      .then(() => {
        clearTimeout(timeoutHandle);
        processRef.exitCode = 0;
        logger.info('[PastelChat] Durable state flushed; shutdown complete');
      })
      .catch(async (error) => {
        logger.error('[PastelChat] Graceful shutdown failed:', error.message);
        await timeoutPromise;
      });

    shutdownPromise = Promise.race([finish, timeoutPromise]);
    return shutdownPromise;
  };

  processRef.once('SIGTERM', () => { shutdown('SIGTERM'); });
  processRef.once('SIGINT', () => { shutdown('SIGINT'); });
  return shutdown;
}

module.exports = { installGracefulShutdown };
