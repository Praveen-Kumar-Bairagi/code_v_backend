const chatService = require('../../../services/v1/user/chatService');
const chatGameService = require('../../../services/v1/user/chatGameService');
const chatThemeService = require('../../../services/v1/user/chatThemeService');
const e2eeKeyService = require('../../../services/v1/user/e2eeKeyService');
const chatModerationService = require('../../../services/chatModerationService');

async function listConversations(req, res, next) {
  try {
    const data = await chatService.listConversations(req.userId, {
      limit: req.query.limit,
      offset: req.query.offset,
      filter: req.query.filter,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function setFavorite(req, res, next) {
  try {
    const data = await chatService.setFavorite(req.userId, req.params.id, req.body?.favorite);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function setMuted(req, res, next) {
  try {
    const data = await chatService.setMuted(req.userId, req.params.id, req.body?.muted);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function setArchived(req, res, next) {
  try {
    const data = await chatService.setArchived(req.userId, req.params.id, req.body?.archived);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getConversation(req, res, next) {
  try {
    const data = await chatService.getConversation(req.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listMessages(req, res, next) {
  try {
    const data = await chatService.listMessages(req.userId, req.params.id, {
      limit: req.query.limit,
      before: req.query.before,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

const LOG_CHAT_TIMINGS = process.env.NODE_ENV !== 'production' || process.env.CHAT_PERF_LOG === 'true';

async function sendMessage(req, res, next) {
  const started = process.hrtime.bigint();
  const conversationId = req.params.id;
  const timings = {};
  let status = 'error';
  try {
    const data = await chatService.sendMessage(req.userId, conversationId, req.body.body, {
      replyToId: req.body.replyToId,
      clientMessageId: req.body.clientMessageId,
      e2ee: req.body.e2ee,
      moderation: req.body.moderation,
      timings,
    });
    status = timings.duplicate ? 'duplicate' : 'ok';
    const total = Number(process.hrtime.bigint() - started) / 1e6;
    res.set(
      'Server-Timing',
      `checks;dur=${(timings.checks || 0).toFixed(1)}, persist;dur=${(timings.persist || 0).toFixed(1)}, total;dur=${total.toFixed(1)}`
    );
    res.status(timings.duplicate ? 200 : 201).json({ success: true, data });
  } catch (err) {
    status = `error_${err?.statusCode || err?.status || 500}`;
    next(err);
  } finally {
    if (LOG_CHAT_TIMINGS) {
      // Ids and durations only — never the message text.
      console.log(
        '[chat-send]',
        JSON.stringify({
          conversationId,
          status,
          checksMs: timings.checks != null ? Math.round(timings.checks * 10) / 10 : null,
          persistMs: timings.persist != null ? Math.round(timings.persist * 10) / 10 : null,
          totalMs: Math.round((Number(process.hrtime.bigint() - started) / 1e6) * 10) / 10,
        })
      );
    }
  }
}

async function registerDeviceKey(req, res, next) {
  try {
    const data = await e2eeKeyService.registerDeviceKey(req.userId, req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getConversationKeys(req, res, next) {
  try {
    const data = await chatService.getConversationKeys(req.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** The filter now runs on the sender's phone (it can't read encrypted messages here). */
async function moderationConfig(req, res, next) {
  try {
    const data = await chatModerationService.loadConfig();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getOrCreateWithUser(req, res, next) {
  try {
    const data = await chatService.getOrCreateConversation(req.userId, req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const data = await chatService.markConversationRead(req.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function unreadTotal(req, res, next) {
  try {
    const data = await chatService.getUnreadTotal(req.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listGames(req, res, next) {
  try {
    const data = await chatGameService.listGames(req.userId, req.query.conversationId || null);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function playGame(req, res, next) {
  try {
    const data = await chatGameService.playGame(req.userId, req.params.id, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listThemes(req, res, next) {
  try {
    res.json({ success: true, data: await chatThemeService.listActiveThemes() });
  } catch (err) {
    next(err);
  }
}

async function setTheme(req, res, next) {
  try {
    const data = await chatThemeService.setConversationTheme(
      req.userId,
      req.params.id,
      req.body?.themeId || null
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listThemes,
  setTheme,
  listGames,
  playGame,
  listConversations,
  setFavorite,
  setMuted,
  setArchived,
  getConversation,
  listMessages,
  sendMessage,
  getOrCreateWithUser,
  markRead,
  unreadTotal,
  registerDeviceKey,
  getConversationKeys,
  moderationConfig,
};
