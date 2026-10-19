const express = require('express');
const authRoutes = require('./user/auth.routes');
const profileRoutes = require('./user/profile.routes');
const peopleRoutes = require('./user/people.routes');
const bookingRoutes = require('./user/booking.routes');
const chatRoutes = require('./user/chat.routes');
const notificationRoutes = require('./user/notification.routes');
const walletRoutes = require('./user/wallet.routes');
const accountSettingsRoutes = require('./user/accountSettings.routes');
const subscriptionRoutes = require('./user/subscription.routes');
const likeRoutes = require('./user/like.routes');
const blockRoutes = require('./user/block.routes');
const publicSubscriptionRoutes = require('./public/subscription.routes');
const cityRoutes = require('./common/city.routes');
const legalRoutes = require('./common/legal.routes');
const companionCategoryRoutes = require('./common/companionCategory.routes');
const supportSubjectRoutes = require('./common/supportSubject.routes');
const adminRoutes = require('./admin');
const appUpdateService = require('../../services/v1/common/appUpdateService');
const env = require('../../config/env');

const router = express.Router();

const phase2Disabled = (feature) => (req, res) => {
  res.status(410).json({ success: false, message: `${feature} are coming in Phase 2.` });
};

router.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

router.get('/app-config', (req, res) => {
  res.json({ success: true, data: { features: { bookings: env.features.bookings, plans: true } } });
});

router.get('/app-version', async (req, res, next) => {
  try {
    const data = await appUpdateService.checkVersion({
      platform: String(req.query.platform || '').toLowerCase(),
      version: req.query.version,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// common / public — before catch-all chat mount
router.use('/cities', cityRoutes);
router.use('/legal', legalRoutes);
router.use('/companion-categories', companionCategoryRoutes);
router.use('/plan-types', require('./common/planType.routes'));
router.use('/support-subjects', supportSubjectRoutes);
router.use('/public/subscription', publicSubscriptionRoutes);

// admin
router.use('/admin', adminRoutes);

// user
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/people', peopleRoutes);
router.use('/bookings', env.features.bookings ? bookingRoutes : phase2Disabled('Bookings'));
router.use('/plans', require('./user/plan.routes'));
router.use('/coins', require('./user/coin.routes'));
router.use('/notifications', notificationRoutes);
router.use('/likes', likeRoutes);
router.use('/blocks', blockRoutes);
router.use('/reports', require('./user/report.routes'));
router.use('/vouchers', require('./user/voucher.routes'));
router.use('/wallet', walletRoutes);
router.use('/settings', accountSettingsRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/payments', require('./user/payment.routes'));
router.use('/creator-request', require('./user/creatorRequest.routes'));
router.use('/capture', require('./user/capture.routes'));
router.use('/', chatRoutes);

module.exports = router;
