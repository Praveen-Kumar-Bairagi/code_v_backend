const express = require('express');
const legalController = require('../../../controllers/v1/common/legalController');

const router = express.Router();

router.get('/', legalController.list);
router.get('/:slug', legalController.getBySlug);

module.exports = router;
