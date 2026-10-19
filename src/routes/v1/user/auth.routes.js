const express = require('express');
const authController = require('../../../controllers/v1/user/authController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.post('/request-otp', authController.requestOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/google', authController.googleLogin);
router.post('/register', authController.register);
router.post('/mobile/request-otp', authenticateUser, authController.requestLinkMobileOtp);
router.post('/mobile/verify', authenticateUser, authController.verifyLinkMobile);
router.get('/me', authenticateUser, authController.me);
router.post('/ensure-session', authenticateUser, authController.ensureSession);

module.exports = router;
