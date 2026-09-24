const AUTHENTICATED_ROOM = 'authenticated';

function userRoom(userId) {
  return `user:${String(userId)}`;
}

// Only the server calls this after verifying the socket's session.
function joinAuthenticatedRooms(socket, userId) {
  socket.join(AUTHENTICATED_ROOM);
  socket.join(userRoom(userId));
}

function emitToUser(io, userId, event, payload) {
  if (!io || userId == null) return;
  if (io.to) return io.to(userRoom(userId)).emit(event, payload);
  io.sockets?.sockets?.forEach(socket => {
    if (socket.user && String(socket.user._id) === String(userId)) socket.emit(event, payload);
  });
}

function emitToUsers(io, userIds, event, payload) {
  if (!io) return;
  const ids = [...new Set([...userIds].filter(id => id != null).map(String))];
  if (!ids.length) return;
  if (io.to) return io.to(ids.map(userRoom)).emit(event, payload);
  ids.forEach(id => emitToUser(io, id, event, payload));
}

function emitToAuthenticatedUsers(io, event, payload) {
  if (!io) return;
  if (io.to) return io.to(AUTHENTICATED_ROOM).emit(event, payload);
  io.sockets?.sockets?.forEach(socket => {
    if (socket.user?._id) socket.emit(event, payload);
  });
}

module.exports = { userRoom, joinAuthenticatedRooms, emitToUser, emitToUsers, emitToAuthenticatedUsers };
