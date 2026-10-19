'use strict';

const express = require('express');
const voucherService = require('../../../services/v1/user/voucherService');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/', async (req, res, next) => {
  try {
    const data = await voucherService.listForUser(req.userId, { appliesTo: req.query.appliesTo });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/lookup', async (req, res, next) => {
  try {
    const data = await voucherService.lookup(req.userId, req.body?.code);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/quote', async (req, res, next) => {
  try {
    const data = await voucherService.quoteForItem(req.userId, req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/redeem', async (req, res, next) => {
  try {
    const data = await voucherService.redeemReward(req.userId, req.body?.code);
    res.json({ success: true, message: data.message, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
