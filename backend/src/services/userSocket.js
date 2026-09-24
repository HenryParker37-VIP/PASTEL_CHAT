/** Deliver private events only to sockets authenticated as the recipient. */
function emitToUser(io, userId, event, payload) {
  const sockets = io?.sockets?.sockets;
  if (!sockets || !userId) return;
  sockets.forEach(socket => {
    if (socket.user && String(socket.user._id) === String(userId)) socket.emit(event, payload);
  });
}

module.exports = { emitToUser };
