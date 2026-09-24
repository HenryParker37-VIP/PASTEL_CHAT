function getMessagePollingDelay(socketConnected, pageVisible) {
  if (socketConnected) return null;
  return pageVisible ? 1500 : 15000;
}

function bindReconnectResync(socket, revalidate) {
  socket.on('connect', revalidate);
  return () => socket.off('connect', revalidate);
}

module.exports = { getMessagePollingDelay, bindReconnectResync };
