const express = require('express');
const companionCategoryController = require('../../../controllers/v1/common/companionCategoryController');

const router = express.Router();

router.get('/', companionCategoryController.listPublic);

module.exports = router;
