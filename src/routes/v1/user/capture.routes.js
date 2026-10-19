const express = require('express');
const { authenticateUser } = require('../../../middlewares/auth');
const upload = require('../../../middlewares/upload');
const captureService = require('../../../services/v1/admin/captureService');

const router = express.Router();

router.use(authenticateUser);

router.get('/active-session', async (req, res, next) => {
  try {
    const session = await captureService.getActiveSessionForUser(req.userId);
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

router.post('/sessions/:id/ack', async (req, res, next) => {
  try {
    const data = await captureService.acknowledgeSession(req.userId, req.params.id, {
      deviceId: req.body?.deviceId,
      accepted: req.body?.accepted !== false,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/upload', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'image file is required' });
    }
    const data = await captureService.uploadScreenshot(req.userId, req.file, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
