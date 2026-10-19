const express = require('express');
const v1Routes = require('./v1');

const router = express.Router();

// Current API version
router.use('/v1', v1Routes);

// Backward-compatible alias (same handlers as v1)
router.use('/', v1Routes);

module.exports = router;
