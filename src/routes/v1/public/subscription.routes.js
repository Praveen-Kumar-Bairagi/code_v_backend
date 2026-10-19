'use strict';

const express = require('express');
const subscriptionController = require('../../../controllers/v1/user/subscriptionController');

const router = express.Router();

router.get('/plans', subscriptionController.listPublicPlans);

module.exports = router;
