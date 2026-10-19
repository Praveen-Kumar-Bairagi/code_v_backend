const express = require('express');
const coinController = require('../../../controllers/v1/user/coinController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/', coinController.wallet);
router.get('/packs', coinController.packs);

module.exports = router;
