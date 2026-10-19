const express = require('express');
const cityRoutes = require('./city.routes');
const legalRoutes = require('./legal.routes');
const companionCategoryRoutes = require('./companionCategory.routes');

const router = express.Router();

router.use('/cities', cityRoutes);
router.use('/legal', legalRoutes);
router.use('/companion-categories', companionCategoryRoutes);

module.exports = router;
