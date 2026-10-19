const express = require('express');
const cityController = require('../../../controllers/v1/common/cityController');

const router = express.Router();

router.get('/', cityController.listActive);
router.get('/areas/search', cityController.searchAreas);
router.get('/:id/areas', cityController.listAreas);

module.exports = router;
