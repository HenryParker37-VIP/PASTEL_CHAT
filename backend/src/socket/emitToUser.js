const userRoom = (userId) => `user:${String(userId)}`;

function emitToUser(io, userId, event, payload) {
  if (!io || typeof io.to !== 'function' || userId == null) return false;
  io.to(userRoom(userId)).emit(event, payload);
  return true;
}

module.exports = { userRoom, emitToUser };
