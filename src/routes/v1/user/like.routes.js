const express = require('express');
const likeController = require('../../../controllers/v1/user/likeController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.post('/', likeController.sendLike);
router.post('/skip', likeController.skipPerson);
router.get('/received', likeController.listReceived);
router.get('/sent', likeController.listSent);
router.get('/skips', likeController.listSkips);
router.delete('/skips/:id', likeController.undoSkip);
router.get('/status/:userId', likeController.statusWith);
router.post('/:id/respond', likeController.respond);

module.exports = router;
