const express = require('express');
const planTypeService = require('../../../services/v1/common/planTypeService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({ success: true, data: await planTypeService.listPlanTypes() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
