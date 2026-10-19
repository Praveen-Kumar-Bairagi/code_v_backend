const express = require('express');
const authRoutes = require('./auth.routes');
const peopleRoutes = require('./people.routes');
const bookingRoutes = require('./booking.routes');
const chatRoutes = require('./chat.routes');
const notificationRoutes = require('./notification.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/people', peopleRoutes);
router.use('/bookings', bookingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/', chatRoutes);

module.exports = router;
