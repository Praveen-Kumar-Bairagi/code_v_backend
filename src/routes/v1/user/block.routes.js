'use strict';

const express = require('express');
const blockController = require('../../../controllers/v1/user/blockController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/', blockController.listBlocked);
router.post('/', blockController.block);
router.post('/unmatch', blockController.unmatch);
router.delete('/:userId', blockController.unblock);

module.exports = router;
