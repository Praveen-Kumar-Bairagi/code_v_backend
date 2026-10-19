'use strict';

const express = require('express');
const accountSettingsController = require('../../../controllers/v1/user/accountSettingsController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/sessions', accountSettingsController.listSessions);
router.delete('/sessions/:sessionId', accountSettingsController.revokeSession);
router.post('/sessions/register', accountSettingsController.registerDevice);

router.post('/account/deactivate/request-otp', accountSettingsController.requestDeactivateOtp);
router.post('/account/deactivate', accountSettingsController.deactivateAccount);
router.post('/account/delete/request-otp', accountSettingsController.requestDeleteOtp);
router.post('/account/delete', accountSettingsController.deleteAccount);

module.exports = router;
