const express = require('express');
const creatorRequestController = require('../../../controllers/v1/user/creatorRequestController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/', creatorRequestController.getMyStatus);
router.post('/', creatorRequestController.submitRequest);

module.exports = router;
