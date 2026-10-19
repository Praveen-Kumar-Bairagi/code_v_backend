const chatModerationService = require('../../../services/chatModerationService');

async function getSettings(req, res, next) {
  try {
    const data = await chatModerationService.getSettings();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const data = await chatModerationService.updateSettings(req.body || {});
    res.json({ success: true, message: 'Chat moderation settings saved', data });
  } catch (err) {
    next(err);
  }
}

async function preview(req, res, next) {
  try {
    const data = await chatModerationService.previewText(req.body?.text);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const data = await chatModerationService.getStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listLogs(req, res, next) {
  try {
    const data = await chatModerationService.listLogs({
      page: req.query.page,
      limit: req.query.limit,
      category: req.query.category,
      severity: req.query.severity,
      reviewStatus: req.query.reviewStatus,
      search: req.query.search,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function reviewLog(req, res, next) {
  try {
    const adminId = req.adminId || null;
    const data = await chatModerationService.reviewLog(req.params.id, req.body || {}, adminId);
    res.json({ success: true, message: 'Review saved', data });
  } catch (err) {
    next(err);
  }
}

async function restoreChatAccess(req, res, next) {
  try {
    const data = await chatModerationService.restoreChatAccess(req.params.userId);
    res.json({ success: true, message: 'Chat access restored', data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
  preview,
  getStats,
  listLogs,
  reviewLog,
  restoreChatAccess,
};
