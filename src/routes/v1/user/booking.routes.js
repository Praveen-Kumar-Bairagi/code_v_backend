const express = require('express');
const bookingController = require('../../../controllers/v1/user/bookingController');
const { authenticateUser } = require('../../../middlewares/auth');

const router = express.Router();

router.use(authenticateUser);

router.post('/', bookingController.createBooking);
router.get('/', bookingController.listBookings);
router.get('/:id', bookingController.getBooking);
router.post('/:id/respond', bookingController.respondBooking);
router.post('/:id/select-request', bookingController.selectRequest);
router.post('/:id/confirm-payment', bookingController.confirmPayment);
router.post('/:id/verify-meet-code', bookingController.verifyMeetCode);
router.post('/:id/accept', bookingController.acceptBooking);
router.post('/:id/decline', bookingController.declineBooking);
router.post('/:id/cancel', bookingController.cancelBooking);

module.exports = router;
