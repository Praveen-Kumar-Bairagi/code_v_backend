'use strict';

const express = require('express');
const reportService = require('../../../services/v1/user/reportService');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/reasons', (req, res) => {
  res.json({ success: true, data: reportService.listReasons() });
});

router.post('/', async (req, res, next) => {
  try {
    const data = await reportService.createReport(req.userId, req.body || {});
    res.status(201).json({ success: true, message: 'Report sent. Our team will review it.', data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
