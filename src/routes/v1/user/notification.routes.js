const express = require('express');
const notificationController = require('../../../controllers/v1/user/notificationController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.post('/push-token', notificationController.registerPushToken);
router.delete('/push-token', notificationController.unregisterPushToken);
router.post('/read-all', notificationController.markAllRead);
router.post('/:id/read', notificationController.markRead);

module.exports = router;
