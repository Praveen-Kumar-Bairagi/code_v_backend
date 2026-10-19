const express = require('express');
const peopleController = require('../../../controllers/v1/user/peopleController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/', peopleController.listPeople);
router.get('/:id', peopleController.getPerson);

module.exports = router;
