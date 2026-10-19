const express = require('express');
const planController = require('../../../controllers/v1/user/planController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/nearby', planController.nearby);
router.get('/mine', planController.mine);
router.post('/', planController.create);
router.post('/:id/cancel', planController.cancel);
router.post('/:id/interest', planController.respond);

module.exports = router;
