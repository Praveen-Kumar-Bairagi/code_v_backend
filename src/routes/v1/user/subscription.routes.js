'use strict';

const express = require('express');
const subscriptionController = require('../../../controllers/v1/user/subscriptionController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.get('/plans', authenticateUser, subscriptionController.listPlansUser);
router.get('/status', authenticateUser, subscriptionController.getStatus);
router.post('/purchase', authenticateUser, subscriptionController.purchase);

module.exports = router;
