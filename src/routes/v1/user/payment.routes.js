'use strict';

const express = require('express');
const paymentController = require('../../../controllers/v1/user/paymentController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

// Public — Razorpay hosted checkout, redirect callback and webhook
router.get('/checkout/:id', paymentController.checkoutPage);
router.post('/razorpay/callback', paymentController.callback);
router.post('/razorpay/webhook', paymentController.webhook);

router.post('/orders/subscription', authenticateUser, paymentController.createSubscriptionOrder);
router.post('/orders/coins', authenticateUser, paymentController.createCoinPackOrder);
router.post('/orders/booking', authenticateUser, paymentController.createBookingOrder);
router.post('/orders/wallet-topup', authenticateUser, paymentController.createWalletTopupOrder);
router.post('/verify', authenticateUser, paymentController.verify);
router.get('/orders/:id', authenticateUser, paymentController.getOrder);

module.exports = router;
