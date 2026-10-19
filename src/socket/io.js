let io = null;

function setIO(instance) {
  io = instance;
}

function getIO() {
  return io;
}

function emitToUser(userId, event, payload) {
  if (!io || userId == null) return;
  io.to(`user:${userId}`).emit(event, payload);
}

/**
 * True when the user has this conversation's chat screen open with the app in the foreground.
 * Older app builds never report it, so they keep getting pushes as before.
 */
function isUserViewingConversation(userId, conversationId) {
  if (!io || userId == null || conversationId == null) return false;
  const ids = io.sockets.adapter.rooms.get(`user:${userId}`);
  if (!ids) return false;
  for (const id of ids) {
    const data = io.sockets.sockets.get(id)?.data;
    if (data?.appActive === true && String(data.viewingConversationId) === String(conversationId)) {
      return true;
    }
  }
  return false;
}

/** Online = connected with the app on screen (older builds don't report app state, so connected counts). */
function isUserOnline(userId) {
  if (!io || userId == null) return false;
  const ids = io.sockets.adapter.rooms.get(`user:${userId}`);
  if (!ids) return false;
  for (const id of ids) {
    const socket = io.sockets.sockets.get(id);
    if (socket && socket.data?.appActive !== false) return true;
  }
  return false;
}

function emitToConversation(conversationId, event, payload) {
  if (!io || conversationId == null) return;
  io.to(`conversation:${conversationId}`).emit(event, payload);
}

/** Admins that joined `admin:loc:{userId}` receive live GPS updates. */
function emitLocationLive(userId, payload) {
  if (!io || userId == null) return;
  io.to(`admin:loc:${userId}`).emit('location:live', {
    userId: String(userId),
    ...payload,
  });
}

module.exports = {
  setIO,
  getIO,
  emitToUser,
  emitToConversation,
  emitLocationLive,
  isUserViewingConversation,
  isUserOnline,
};
