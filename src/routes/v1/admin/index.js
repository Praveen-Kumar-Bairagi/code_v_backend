const express = require('express');
const adminController = require('../../../controllers/v1/admin/adminController');
const companionCategoryController = require('../../../controllers/v1/common/companionCategoryController');
const withdrawalController = require('../../../controllers/v1/admin/withdrawalController');
const coinController = require('../../../controllers/v1/user/coinController');
const userPlanController = require('../../../controllers/v1/admin/userPlanController');
const dashboardService = require('../../../services/v1/admin/dashboardService');
const userActivityService = require('../../../services/v1/admin/userActivityService');
const adminReportService = require('../../../services/v1/admin/reportService');
const legalRequestService = require('../../../services/v1/admin/legalRequestService');
const { authenticateAdmin } = require('../../../middlewares/auth');

const router = express.Router();

router.post('/login', adminController.login);
router.get('/me', authenticateAdmin, adminController.me);
router.put('/profile', authenticateAdmin, adminController.updateProfile);
router.post('/change-password', authenticateAdmin, adminController.changePassword);

router.get('/dashboard/stats', authenticateAdmin, adminController.dashboardStats);
router.get('/dashboard/overview', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await dashboardService.getOverview() });
  } catch (err) {
    next(err);
  }
});
const smsService = require('../../../services/smsService');
router.get('/sms/balance', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await smsService.getBalance() });
  } catch (err) {
    next(err);
  }
});
const chatThemeService = require('../../../services/v1/user/chatThemeService');
const upload = require('../../../middlewares/upload');
router.get('/chat-themes', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await chatThemeService.adminList() });
  } catch (err) {
    next(err);
  }
});
router.post('/chat-themes', authenticateAdmin, upload.single('image'), async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await chatThemeService.adminCreate(req.body || {}, req.file) });
  } catch (err) {
    next(err);
  }
});
router.patch('/chat-themes/:id', authenticateAdmin, upload.single('image'), async (req, res, next) => {
  try {
    res.json({ success: true, data: await chatThemeService.adminUpdate(req.params.id, req.body || {}, req.file) });
  } catch (err) {
    next(err);
  }
});
router.delete('/chat-themes/:id', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await chatThemeService.adminRemove(req.params.id) });
  } catch (err) {
    next(err);
  }
});
const smsLogService = require('../../../services/v1/admin/smsLogService');
router.get('/sms/logs', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await smsLogService.listLogs(req.query) });
  } catch (err) {
    next(err);
  }
});
router.get('/sms/logs/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await smsLogService.getLog(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'SMS log not found' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
router.get('/dashboard/details/:type', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await dashboardService.getDetails(req.params.type, req.query);
    if (!data) return res.status(404).json({ success: false, message: 'Unknown details type' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/users', authenticateAdmin, adminController.listUsers);
router.post('/users', authenticateAdmin, adminController.createUser);
router.get('/users/:id', authenticateAdmin, adminController.getUser);
router.get('/users/:id/activity', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await userActivityService.getUserActivity(req.params.id) });
  } catch (err) {
    next(err);
  }
});
router.get('/users/:id/legal-requests', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await legalRequestService.listRequests(req.params.id) });
  } catch (err) {
    next(err);
  }
});
router.post('/users/:id/legal-requests', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await legalRequestService.createRequest(req.adminId, req.params.id, req.body || {});
    res.status(201).json({ success: true, message: 'Request logged and records placed on hold', data });
  } catch (err) {
    next(err);
  }
});
router.get('/legal-requests/:id/export', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await legalRequestService.exportForRequest(req.params.id) });
  } catch (err) {
    next(err);
  }
});
router.get('/reports', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await adminReportService.listReports(req.query) });
  } catch (err) {
    next(err);
  }
});
router.get('/reports/:id', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await adminReportService.getReport(req.params.id) });
  } catch (err) {
    next(err);
  }
});
router.patch('/reports/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await adminReportService.updateReport(req.params.id, req.body || {});
    res.json({ success: true, message: 'Report updated', data });
  } catch (err) {
    next(err);
  }
});
router.delete('/users/:id/photos/:index', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await userActivityService.removeUserPhoto(req.params.id, req.params.index);
    res.json({ success: true, message: 'Photo removed', data });
  } catch (err) {
    next(err);
  }
});
router.patch('/users/:id/settings', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await userActivityService.updateUserSettings(req.params.id, req.body || {});
    res.json({ success: true, message: 'Settings saved', data });
  } catch (err) {
    next(err);
  }
});
router.put('/users/:id', authenticateAdmin, adminController.updateUser);
router.patch('/users/:id', authenticateAdmin, adminController.updateUser);
router.patch('/users/:id/status', authenticateAdmin, adminController.patchUserStatus);

router.get('/companies', authenticateAdmin, adminController.listCompanies);
router.get('/companies/:id', authenticateAdmin, adminController.getCompany);
router.patch('/companies/:id/status', authenticateAdmin, adminController.patchCompanyStatus);
router.patch('/companies/:id/creator', authenticateAdmin, adminController.patchCompanyCreator);

router.get('/cities', authenticateAdmin, adminController.listCities);
router.post('/cities', authenticateAdmin, adminController.createCity);
router.post('/cities/bulk-status', authenticateAdmin, adminController.bulkCityStatus);

const cityAreaController = require('../../../controllers/v1/admin/cityAreaController');
router.get('/city-areas', authenticateAdmin, cityAreaController.list);
router.post('/city-areas', authenticateAdmin, cityAreaController.create);
router.post('/city-areas/bulk-status', authenticateAdmin, cityAreaController.bulkStatus);
router.post('/city-areas/lookup', authenticateAdmin, cityAreaController.lookup);
router.patch('/city-areas/:id', authenticateAdmin, cityAreaController.update);
router.delete('/city-areas/:id', authenticateAdmin, cityAreaController.remove);

const planTypeController = require('../../../controllers/v1/admin/planTypeController');
router.get('/plan-types', authenticateAdmin, planTypeController.list);
router.post('/plan-types', authenticateAdmin, planTypeController.create);
router.patch('/plan-types/:id', authenticateAdmin, planTypeController.update);
router.delete('/plan-types/:id', authenticateAdmin, planTypeController.remove);
router.patch('/cities/:id', authenticateAdmin, adminController.updateCity);
router.delete('/cities/:id', authenticateAdmin, adminController.deleteCity);

router.get('/bookings', authenticateAdmin, adminController.listBookings);
router.get('/bookings/:id', authenticateAdmin, adminController.getBooking);

router.get('/withdrawals', authenticateAdmin, withdrawalController.listWithdrawals);
router.post(
  '/withdrawals/:id/review',
  authenticateAdmin,
  withdrawalController.reviewWithdrawal
);

router.get('/legal', authenticateAdmin, adminController.listLegal);
router.put('/legal/:slug', authenticateAdmin, adminController.updateLegal);

router.get('/platform-settings', authenticateAdmin, adminController.getPlatformSettings);
router.put('/platform-settings', authenticateAdmin, adminController.updatePlatformSettings);

const appUpdateService = require('../../../services/v1/common/appUpdateService');
router.get('/app-update', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await appUpdateService.getConfig() });
  } catch (err) {
    next(err);
  }
});
router.put('/app-update', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await appUpdateService.updateConfig(req.body || {}) });
  } catch (err) {
    next(err);
  }
});

router.get('/companion-categories', authenticateAdmin, companionCategoryController.list);
router.post('/companion-categories', authenticateAdmin, companionCategoryController.create);
router.patch('/companion-categories/:id', authenticateAdmin, companionCategoryController.update);
router.delete('/companion-categories/:id', authenticateAdmin, companionCategoryController.remove);
router.get('/companion-category-groups', authenticateAdmin, companionCategoryController.listGroups);
router.post('/companion-category-groups', authenticateAdmin, companionCategoryController.createGroup);
router.patch('/companion-category-groups/:id', authenticateAdmin, companionCategoryController.updateGroup);
router.delete('/companion-category-groups/:id', authenticateAdmin, companionCategoryController.removeGroup);

const supportSubjectController = require('../../../controllers/v1/common/supportSubjectController');
router.get('/support-subjects', authenticateAdmin, supportSubjectController.list);
router.post('/support-subjects', authenticateAdmin, supportSubjectController.create);
router.patch('/support-subjects/:id', authenticateAdmin, supportSubjectController.update);
router.delete('/support-subjects/:id', authenticateAdmin, supportSubjectController.remove);

const subscriptionController = require('../../../controllers/v1/user/subscriptionController');
router.get('/subscriptions/plans', authenticateAdmin, subscriptionController.listPlansAdmin);
router.post('/subscriptions/plans', authenticateAdmin, subscriptionController.createPlan);
router.patch('/subscriptions/plans/:id', authenticateAdmin, subscriptionController.updatePlan);

router.get('/coins/settings', authenticateAdmin, coinController.adminSettings);
router.put('/coins/settings', authenticateAdmin, coinController.adminUpdateSettings);
router.get('/coins/packs', authenticateAdmin, coinController.adminListPacks);
router.post('/coins/packs', authenticateAdmin, coinController.adminCreatePack);
router.patch('/coins/packs/:id', authenticateAdmin, coinController.adminUpdatePack);
router.delete('/coins/packs/:id', authenticateAdmin, coinController.adminDeletePack);
const chatGameController = require('../../../controllers/v1/admin/chatGameController');
router.get('/chat-games', authenticateAdmin, chatGameController.list);
router.patch('/chat-games/:id', authenticateAdmin, chatGameController.update);

router.get('/subscriptions/purchases', authenticateAdmin, subscriptionController.listPurchases);
router.get('/user-plans', authenticateAdmin, userPlanController.list);

const creatorRequestController = require('../../../controllers/v1/user/creatorRequestController');
router.get('/creator-requests', authenticateAdmin, creatorRequestController.listRequestsAdmin);
router.post(
  '/creator-requests/:id/review',
  authenticateAdmin,
  creatorRequestController.reviewRequestAdmin
);

const chatModerationController = require('../../../controllers/v1/admin/chatModerationController');
router.get('/chat-moderation/settings', authenticateAdmin, chatModerationController.getSettings);
router.put('/chat-moderation/settings', authenticateAdmin, chatModerationController.updateSettings);
router.post('/chat-moderation/preview', authenticateAdmin, chatModerationController.preview);
router.get('/chat-moderation/logs', authenticateAdmin, chatModerationController.listLogs);
router.get('/chat-moderation/stats', authenticateAdmin, chatModerationController.getStats);
router.post('/chat-moderation/logs/:id/review', authenticateAdmin, chatModerationController.reviewLog);
router.post(
  '/chat-moderation/users/:userId/restore',
  authenticateAdmin,
  chatModerationController.restoreChatAccess
);

const broadcastService = require('../../../services/v1/admin/broadcastService');
router.get('/notifications/audience', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await broadcastService.countAudience(req.query) });
  } catch (err) {
    next(err);
  }
});
router.get('/notifications/users', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await broadcastService.listPushReadyUsers(req.query) });
  } catch (err) {
    next(err);
  }
});
router.get('/notifications', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await broadcastService.listBroadcasts(req.query) });
  } catch (err) {
    next(err);
  }
});
router.post('/notifications', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await broadcastService.sendBroadcast(req.adminId, req.body || {});
    res.status(201).json({ success: true, message: 'Notification is being sent', data });
  } catch (err) {
    next(err);
  }
});

const voucherAdminService = require('../../../services/v1/admin/voucherAdminService');
router.get('/vouchers', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await voucherAdminService.list(req.query) });
  } catch (err) {
    next(err);
  }
});
router.post('/vouchers', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await voucherAdminService.create(req.adminId, req.body || {});
    res.status(201).json({ success: true, message: 'Voucher created', data });
  } catch (err) {
    next(err);
  }
});
router.patch('/vouchers/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await voucherAdminService.update(req.adminId, req.params.id, req.body || {});
    res.json({ success: true, message: 'Voucher updated', data });
  } catch (err) {
    next(err);
  }
});
router.delete('/vouchers/:id', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await voucherAdminService.remove(req.params.id) });
  } catch (err) {
    next(err);
  }
});
router.get('/vouchers/:id/redemptions', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await voucherAdminService.redemptions(req.params.id, req.query) });
  } catch (err) {
    next(err);
  }
});

router.get('/bio-requests', authenticateAdmin, adminController.listBioRequests);
router.post(
  '/bio-requests/:id/review',
  authenticateAdmin,
  adminController.reviewBioRequest
);

const multer = require('multer');
const captureService = require('../../../services/v1/admin/captureService');
const { verifyAccessToken, MAX_RECORDING_BYTES } = require('../../../services/captureStorage');

const recordingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECORDING_BYTES || 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['video/webm', 'video/mp4'].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Only WebM or MP4 recordings are allowed'));
  },
});

router.get('/users/:userId/capture/device', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await captureService.getDeviceStatus(req.params.userId) });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:userId/capture/sessions', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await captureService.requestSession(req.adminId, req.params.userId, {
      deviceId: req.body?.deviceId,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/capture/sessions/:id/end', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await captureService.endSession(
      req.adminId,
      req.params.id,
      req.body?.reason || 'admin_ended'
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/capture/screenshots', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await captureService.listScreenshots(req.params.userId, req.query),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/capture/days', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await captureService.listDaySummary(req.params.userId) });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:userId/capture/screenshots/delete', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await captureService.deleteScreenshots(
      req.adminId,
      req.params.userId,
      req.body?.ids || []
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/capture/screenshots/:id/access', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await captureService.getScreenshotAccess(req.adminId, req.params.id),
    });
  } catch (err) {
    next(err);
  }
});

/** Private file stream — admin Bearer OR short-lived access token (never public static). */
router.get('/capture/screenshots/:id/file', async (req, res, next) => {
  try {
    let allowed = false;
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      try {
        const { verifyToken } = require('../../../utils/jwt');
        const decoded = verifyToken(header.slice(7));
        if (decoded.purpose === 'admin' && decoded.adminId) allowed = true;
        if (decoded.purpose === 'capture_access' && decoded.screenshotId === req.params.id) {
          allowed = true;
        }
      } catch {
        /* fall through */
      }
    }
    if (!allowed && req.query.token) {
      try {
        const decoded = verifyAccessToken(String(req.query.token));
        if (decoded.screenshotId === req.params.id) allowed = true;
      } catch {
        /* fall through */
      }
    }
    if (!allowed) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { row, buffer } = await captureService.loadScreenshotFile(req.params.id);
    res.setHeader('Content-Type', row.mimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/users/:userId/capture/recordings',
  authenticateAdmin,
  recordingUpload.single('video'),
  async (req, res, next) => {
    try {
      const data = await captureService.saveRecording(req.adminId, req.params.userId, req.file, req.body || {});
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/users/:userId/capture/recordings', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await captureService.listRecordings(req.params.userId, req.query),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:userId/capture/recordings/delete', authenticateAdmin, async (req, res, next) => {
  try {
    const data = await captureService.deleteRecordings(
      req.adminId,
      req.params.userId,
      req.body?.ids || []
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/capture/recordings/:id/access', authenticateAdmin, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await captureService.getRecordingAccess(req.adminId, req.params.id),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/capture/recordings/:id/file', async (req, res, next) => {
  try {
    let allowed = false;
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      try {
        const { verifyToken } = require('../../../utils/jwt');
        const decoded = verifyToken(header.slice(7));
        if (decoded.purpose === 'admin' && decoded.adminId) allowed = true;
        if (decoded.purpose === 'capture_access' && decoded.recordingId === req.params.id) {
          allowed = true;
        }
      } catch {
        /* fall through */
      }
    }
    if (!allowed && req.query.token) {
      try {
        const decoded = verifyAccessToken(String(req.query.token));
        if (decoded.recordingId === req.params.id) allowed = true;
      } catch {
        /* fall through */
      }
    }
    if (!allowed) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { row, buffer } = await captureService.loadRecordingFile(req.params.id);
    res.setHeader('Content-Type', row.mimeType || 'video/webm');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
