const bookingService = require('../../../services/v1/user/bookingService');

async function createBooking(req, res, next) {
  try {
    const data = await bookingService.createBooking(req.userId, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listBookings(req, res, next) {
  try {
    const data = await bookingService.listBookings(req.userId, req.query.tab);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getBooking(req, res, next) {
  try {
    const data = await bookingService.getBookingById(req.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function respondBooking(req, res, next) {
  try {
    const data = await bookingService.respondToBooking(req.userId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function selectRequest(req, res, next) {
  try {
    const data = await bookingService.selectBookingRequest(
      req.userId,
      req.params.id,
      req.body.requestId || req.body.companyRequestId
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function confirmPayment(req, res, next) {
  try {
    const data = await bookingService.confirmPayment(req.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function verifyMeetCode(req, res, next) {
  try {
    const data = await bookingService.verifyMeetCode(
      req.userId,
      req.params.id,
      req.body.code
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function acceptBooking(req, res, next) {
  try {
    const data = await bookingService.acceptBooking(req.userId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function declineBooking(req, res, next) {
  try {
    const data = await bookingService.declineBooking(req.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const data = await bookingService.cancelBooking(req.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBooking,
  listBookings,
  getBooking,
  respondBooking,
  selectRequest,
  confirmPayment,
  verifyMeetCode,
  acceptBooking,
  declineBooking,
  cancelBooking,
};
