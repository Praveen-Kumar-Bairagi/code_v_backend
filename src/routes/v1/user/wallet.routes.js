const express = require('express');
const walletController = require('../../../controllers/v1/user/walletController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/', walletController.getWallet);
router.get('/transactions', walletController.listTransactions);
router.post('/top-up', walletController.topUp);
router.get('/withdrawals', walletController.listMyWithdrawals);
router.post('/withdrawals', walletController.requestWithdrawal);

module.exports = router;
