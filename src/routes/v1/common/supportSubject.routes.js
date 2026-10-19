const express = require('express');
const supportSubjectController = require('../../../controllers/v1/common/supportSubjectController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

/** Active subjects for app support form */
router.get('/', authenticateUser, supportSubjectController.listPublic);

module.exports = router;
