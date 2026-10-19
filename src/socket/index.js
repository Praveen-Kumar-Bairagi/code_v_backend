const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const { setIO, isUserOnline } = require('./io');
const { User, Admin, Conversation } = require('../models');
const { settingsOf } = require('../services/v1/user/settingsService');
const profileService = require('../services/v1/user/profileService');

async function assertSocketUserActive(userId) {
  const user = await User.findByPk(userId);
  if (!user || !user.isActive) {
    throw new Error('Unauthorized');
  }
  return user;
}

async function assertSocketAdmin(adminId) {
  const admin = await Admin.findByPk(adminId);
  if (!admin) {
    throw new Error('Unauthorized');
  }
  return admin;
}

async function findConversationForUser(userId, conversationId) {
  if (!conversationId) return null;
  const conversation = await Conversation.findByPk(conversationId, {
    attributes: ['id', 'participantOneId', 'participantTwoId'],
  });
  if (!conversation) return null;
  const uid = String(userId);
  if (String(conversation.participantOneId) !== uid && String(conversation.participantTwoId) !== uid) {
    return null;
  }
  return conversation;
}

async function canJoinConversation(userId, conversationId) {
  return !!(await findConversationForUser(userId, conversationId));
}

function parseCoords(payload = {}) {
  const lat = Number(payload.latitude ?? payload.lat);
  const lng = Number(payload.longitude ?? payload.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

/** Last presence sent per user, so watchers only hear about real changes. */
const lastPresence = new Map();

function broadcastPresence(io, userId) {
  const online = isUserOnline(userId);
  if (lastPresence.get(String(userId)) === online) return;
  lastPresence.set(String(userId), online);
  io.to(`presence:${userId}`).emit('presence:update', { userId, online });
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // Detect killed apps / dropped connections within ~25s so "Online" doesn't linger.
    pingInterval: 15000,
    pingTimeout: 10000,
  });

  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) {
        return next(new Error('Authentication required'));
      }
      let decoded;
      try {
        decoded = verifyToken(token);
      } catch {
        return next(new Error('Invalid or expired token'));
      }

      if (decoded.purpose === 'admin' && decoded.adminId) {
        await assertSocketAdmin(decoded.adminId);
        socket.role = 'admin';
        socket.adminId = decoded.adminId;
        return next();
      }

      if (decoded.purpose === 'user' && decoded.userId) {
        await assertSocketUserActive(decoded.userId);
        socket.role = 'user';
        socket.userId = decoded.userId;
        return next();
      }

      return next(new Error('Forbidden'));
    } catch (err) {
      return next(new Error(err.message || 'Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.role === 'admin') {
      registerAdminHandlers(io, socket);
      return;
    }
    registerUserHandlers(io, socket);
  });

  return io;
}

function registerAdminHandlers(io, socket) {
  socket.join(`admin:${socket.adminId}`);

  socket.on('location:watch', async (userId, ack) => {
    try {
      if (!userId) {
        if (typeof ack === 'function') ack({ ok: false, error: 'userId required' });
        return;
      }
      const user = await User.findByPk(userId, {
        attributes: ['id', 'latitude', 'longitude', 'locationUpdatedAt', 'isActive'],
      });
      if (!user || !user.isActive) {
        if (typeof ack === 'function') ack({ ok: false, error: 'User not found' });
        return;
      }
      socket.join(`admin:loc:${user.id}`);
      if (typeof ack === 'function') {
        ack({
          ok: true,
          userId: user.id,
          latitude: user.latitude != null ? Number(user.latitude) : null,
          longitude: user.longitude != null ? Number(user.longitude) : null,
          locationUpdatedAt: user.locationUpdatedAt || null,
        });
      }
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message || 'Failed' });
    }
  });

  socket.on('location:unwatch', (userId) => {
    if (userId) socket.leave(`admin:loc:${userId}`);
  });
}

function registerUserHandlers(io, socket) {
  const userId = socket.userId;
  socket.join(`user:${userId}`);
  const auth = socket.handshake.auth || {};
  if (typeof auth.appActive === 'boolean') socket.data.appActive = auth.appActive;
  socket.data.viewingConversationId = auth.viewingConversationId || null;
  void broadcastPresence(io, userId);

  socket.on('app:state', (payload) => {
    socket.data.appActive = !!payload?.active;
    if (payload && 'viewingConversationId' in payload) {
      socket.data.viewingConversationId = payload.viewingConversationId || null;
    }
    void broadcastPresence(io, userId);
  });

  socket.on('disconnect', () => {
    void broadcastPresence(io, userId);
  });

  /** Live GPS from the phone (foreground socket). Always keyed by authenticated userId. */
  socket.on('location:update', async (payload, ack) => {
    try {
      const coords = parseCoords(payload);
      if (!coords) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Invalid coordinates' });
        return;
      }
      const saved = await profileService.updateCurrentLocation(
        userId,
        { ...coords, accuracy: payload?.accuracy },
        { source: 'socket' }
      );
      if (typeof ack === 'function') ack({ ok: true, ...saved });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message || 'Failed' });
    }
  });

  /** Follow the other person's online status for a conversation the user is part of. */
  socket.on('presence:watch', async (conversationId, ack) => {
    try {
      const conversation = await findConversationForUser(userId, conversationId);
      if (!conversation) {
        if (typeof ack === 'function') ack({ ok: false });
        return;
      }
      const peerId =
        String(conversation.participantOneId) === String(userId)
          ? conversation.participantTwoId
          : conversation.participantOneId;
      socket.join(`presence:${peerId}`);
      if (typeof ack === 'function') ack({ ok: true, userId: peerId, online: isUserOnline(peerId) });
    } catch {
      if (typeof ack === 'function') ack({ ok: false });
    }
  });

  socket.on('presence:unwatch', (peerId) => {
    if (peerId) socket.leave(`presence:${peerId}`);
  });

  socket.on('conversation:join', async (conversationId, ack) => {
    try {
      const allowed = await canJoinConversation(userId, conversationId);
      if (!allowed) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Forbidden' });
        return;
      }
      socket.join(`conversation:${conversationId}`);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      // Invalid UUID / DB cast errors → treat as forbidden
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Forbidden' });
      }
    }
  });

  socket.on('chat:typing', async (payload) => {
    const conversationId = payload?.conversationId;
    const room = `conversation:${conversationId}`;
    if (!conversationId || !socket.rooms.has(room)) return;
    const me = await User.findByPk(userId, { attributes: ['id', 'settings'] }).catch(() => null);
    if (me && settingsOf(me).hideTyping) return;
    socket.to(room).emit('chat:typing', {
      conversationId,
      userId,
      isTyping: !!payload.isTyping,
    });
  });

  socket.on('conversation:leave', (conversationId) => {
    if (conversationId) {
      socket.leave(`conversation:${conversationId}`);
    }
  });
}

module.exports = { initSocket };
