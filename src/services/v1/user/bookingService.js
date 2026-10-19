const { Op } = require('sequelize');
const {
  Booking,
  BookingRequest,
  User,
  City,
  CompanionCategory,
  sequelize,
} = require('../../../models');
const AppError = require('../../../utils/AppError');
const {
  BOOKING_STATUS,
  BOOKING_REQUEST_STATUS,
  BOOKING_AMOUNT,
  BOOKING_DEADLINE_MS,
} = require('../../../constants/bookingStatus');
const chatService = require('./chatService');
const {
  createAndEmitNotification,
  emitExistingNotification,
} = require('./notificationCreateService');
const { emitToUser } = require('../../../socket/io');
const { expireBookingDeadlines } = require('../../../jobs/bookingDeadlines');
const walletService = require('./walletService');
const cityAreaService = require('../common/cityAreaService');

const entitlements = require('./bookingEntitlementService');

const counterpartAttributes = ['id', 'firstName', 'lastName', 'gender', 'photos'];
const PREFERRED_GENDERS = ['all', 'male', 'female'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function parseCoord(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function deadlineFrom(from = new Date()) {
  return new Date(new Date(from).getTime() + BOOKING_DEADLINE_MS);
}

/** Calendar date in IST (YYYY-MM-DD) — avoids UTC midnight tab mis-bucket near IST night. */
function todayDateOnly() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function startOfTodayIst() {
  const ymd = todayDateOnly();
  return new Date(`${ymd}T00:00:00+05:30`);
}

const ACTIVE_REQUEST_STATUSES = [
  BOOKING_REQUEST_STATUS.PENDING,
  BOOKING_REQUEST_STATUS.ACCEPTED,
  BOOKING_REQUEST_STATUS.SELECTED,
];

async function countActiveRequests(bookingId, transaction) {
  return BookingRequest.count({
    where: {
      bookingId,
      status: { [Op.in]: ACTIVE_REQUEST_STATUSES },
    },
    transaction,
  });
}

async function cancelOpenBookingIfNoActive(
  booking,
  { reason, title, body, now = new Date(), transaction } = {}
) {
  if (
    ![BOOKING_STATUS.PENDING, BOOKING_STATUS.RESPONSES_AVAILABLE].includes(
      booking.status
    )
  ) {
    return false;
  }
  const stillActive = await countActiveRequests(booking.id, transaction);
  if (stillActive > 0) return false;

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelledAt = now;
  booking.cancelReason = reason || 'all_declined';
  await booking.save({ transaction });

  await createAndEmitNotification({
    recipientId: booking.senderId,
    type: 'booking_cancelled',
    title: title || 'Booking cancelled',
    body: body || 'All companions declined. Booking was cancelled.',
    data: { bookingId: booking.id, reason: booking.cancelReason },
    transaction,
  });
  emitToUser(booking.senderId, 'booking:updated', {
    bookingId: booking.id,
    reason: booking.cancelReason,
  });
  return true;
}

function formatWhen(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function generateMeetCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function assignUniqueMeetCodes(booking, { transaction } = {}) {
  if (booking.userMeetCode && booking.companionMeetCode) return booking;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const userMeetCode = booking.userMeetCode || generateMeetCode();
    const companionMeetCode = booking.companionMeetCode || generateMeetCode();
    if (userMeetCode === companionMeetCode) continue;
    booking.userMeetCode = userMeetCode;
    booking.companionMeetCode = companionMeetCode;
    await booking.save({ transaction });
    return booking;
  }
  throw new AppError('Could not generate meet codes', 500);
}

function parseAmount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new AppError('Amount must be a whole number', 400);
  }
  if (n < BOOKING_AMOUNT.MIN || n > BOOKING_AMOUNT.MAX) {
    throw new AppError(
      `Amount must be between ₹${BOOKING_AMOUNT.MIN} and ₹${BOOKING_AMOUNT.MAX}`,
      400
    );
  }
  return n;
}

function formatUserBrief(user) {
  if (!user) return null;
  const json = user.toJSON ? user.toJSON() : user;
  const photos = Array.isArray(json.photos) ? json.photos.filter(Boolean) : [];
  return {
    id: json.id,
    firstName: json.firstName,
    lastName: json.lastName,
    fullName: [json.firstName, json.lastName].filter(Boolean).join(' ').trim(),
    gender: json.gender,
    photoUrl: photos[0] || null,
  };
}

function formatRequest(req, bookingJson = null, viewer = 'receiver') {
  const json = req.toJSON ? req.toJSON() : req;
  const base = {
    id: json.id,
    bookingId: json.bookingId,
    receiverId: json.receiverId,
    status: json.status,
    offeredAmount: json.offeredAmount,
    acceptedAt: json.acceptedAt,
    respondedAt: json.respondedAt,
    respondBy: json.respondBy || null,
    selectedAt: json.selectedAt || null,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
    receiver: formatUserBrief(json.receiver),
  };
  if (bookingJson) {
    base.timeline = buildTimeline(bookingJson, json, viewer);
  }
  return base;
}

/** viewer: receiver = companion; sender = per-response for creator */
function buildTimeline(bookingJson, reqJson, viewer = 'receiver') {
  const steps = [];
  const isSenderView = viewer === 'sender';
  const reqStatus = String(reqJson?.status || '');
  const accepted =
    !!reqJson?.acceptedAt || ['accepted', 'selected'].includes(reqStatus);
  const selected =
    reqStatus === 'selected' ||
    (!!bookingJson.receiverId &&
      !!reqJson?.receiverId &&
      String(bookingJson.receiverId) === String(reqJson.receiverId) &&
      [
        BOOKING_STATUS.PAYMENT_PENDING,
        BOOKING_STATUS.CONFIRMED,
        BOOKING_STATUS.IN_PROGRESS,
      ].includes(bookingJson.status));

  if (isSenderView) {
    steps.push({
      key: 'sent',
      label: 'Request sent',
      at: reqJson?.createdAt || bookingJson.createdAt || null,
      dueAt: null,
      done: true,
    });
    steps.push({
      key: 'accepted',
      label: accepted
        ? ('Accepted · ₹' + (reqJson.offeredAmount ?? '—'))
        : 'Waiting for accept',
      at: reqJson?.acceptedAt || null,
      dueAt: !accepted
        ? reqJson?.respondBy ||
          (reqJson?.createdAt ? deadlineFrom(reqJson.createdAt).toISOString() : null)
        : null,
      done: Boolean(accepted),
    });
  } else {
    steps.push({
      key: 'received',
      label: 'Request received',
      at: reqJson?.createdAt || bookingJson.createdAt || null,
      dueAt: null,
      done: true,
    });
    steps.push({
      key: 'accepted',
      label: accepted
        ? ('You accepted · Earn ₹' + (reqJson.offeredAmount ?? '—'))
        : 'Enter amount & accept',
      at: reqJson?.acceptedAt || null,
      dueAt: !accepted
        ? reqJson?.respondBy ||
          (reqJson?.createdAt ? deadlineFrom(reqJson.createdAt).toISOString() : null)
        : null,
      done: Boolean(accepted),
    });
  }

  const amount = bookingJson.amount ?? reqJson?.offeredAmount ?? '—';
  const paid =
    !!bookingJson.paidAt &&
    (!!reqJson?.receiverId
      ? String(bookingJson.receiverId) === String(reqJson.receiverId)
      : true);

  // After accept: either wait for selection (offer expires 1h from accept)
  // or, once selected, pay within 1h of selection.
  if (accepted) {
    if (selected) {
      steps.push({
        key: 'selected',
        label: isSenderView ? 'Companion selected' : 'You were selected',
        at: reqJson?.selectedAt || null,
        dueAt: null,
        done: true,
      });
      steps.push({
        key: 'payment',
        label: paid
          ? ('Paid ₹' + amount)
          : isSenderView
            ? ('Pay ₹' + amount + ' & confirm')
            : ('Waiting for payment · ₹' + amount),
        at: paid ? bookingJson.paidAt : null,
        dueAt: !paid ? bookingJson.paymentDueAt || null : null,
        done: paid,
      });
    } else {
      steps.push({
        key: 'awaiting_select',
        label: isSenderView
          ? ('Select · ₹' + (reqJson.offeredAmount ?? '—'))
          : 'Waiting to be selected',
        at: null,
        dueAt: reqJson?.acceptedAt
          ? deadlineFrom(reqJson.acceptedAt).toISOString()
          : null,
        done: false,
      });
    }
  }

  if (
    paid &&
    (bookingJson.status === BOOKING_STATUS.CONFIRMED ||
      bookingJson.status === BOOKING_STATUS.IN_PROGRESS ||
      bookingJson.confirmedAt)
  ) {
    steps.push({
      key: 'confirmed',
      label: 'Booking confirmed',
      at: bookingJson.confirmedAt || null,
      dueAt: null,
      done: true,
    });
  }

  if (bookingJson.status === BOOKING_STATUS.CANCELLED && (selected || accepted)) {
    steps.push({
      key: 'cancelled',
      label:
        bookingJson.cancelReason === 'payment_timeout'
          ? 'Cancelled · payment timeout'
          : bookingJson.cancelReason === 'accept_timeout'
            ? 'Cancelled · accept timeout'
            : bookingJson.cancelReason === 'offer_timeout'
              ? 'Cancelled · offer expired'
              : bookingJson.cancelReason === 'all_declined'
                ? 'Cancelled · all declined'
                : bookingJson.cancelReason === 'no_recipients'
                  ? 'Cancelled · no companions'
                  : bookingJson.cancelReason === 'no_accept_before_meet'
                    ? 'Cancelled · no one accepted before meetup'
                    : bookingJson.cancelReason === 'scheduled_passed'
                      ? 'Cancelled · meetup time passed'
                      : 'Cancelled',
      at: bookingJson.cancelledAt || null,
      dueAt: null,
      done: true,
    });
  }

  return steps;
}

function buildSenderBookingTimeline(bookingJson, responseCount = 0) {
  const steps = [
    {
      key: 'created',
      label: 'Booking created',
      at: bookingJson.createdAt || null,
      dueAt: null,
      done: true,
    },
  ];

  if (
    [BOOKING_STATUS.PENDING, BOOKING_STATUS.RESPONSES_AVAILABLE].includes(
      bookingJson.status
    )
  ) {
    steps.push({
      key: 'responses',
      label:
        responseCount > 0
          ? (responseCount + ' response' + (responseCount === 1 ? '' : 's') + ' · select one')
          : 'Waiting for responses',
      at: null,
      dueAt: null,
      done: responseCount > 0,
    });
  }

  if (
    bookingJson.status === BOOKING_STATUS.PAYMENT_PENDING ||
    bookingJson.paidAt ||
    bookingJson.paymentDueAt
  ) {
    const paid = !!bookingJson.paidAt;
    steps.push({
      key: 'payment',
      label: paid
        ? ('Paid ₹' + (bookingJson.amount ?? '—'))
        : ('Pay ₹' + (bookingJson.amount ?? '—') + ' within 1 hour of selection'),
      at: bookingJson.paidAt || null,
      dueAt: !paid ? bookingJson.paymentDueAt || null : null,
      done: paid,
    });
  }

  if (
    bookingJson.status === BOOKING_STATUS.CONFIRMED ||
    bookingJson.status === BOOKING_STATUS.IN_PROGRESS
  ) {
    steps.push({
      key: 'confirmed',
      label: 'Booking confirmed',
      at: bookingJson.confirmedAt || null,
      dueAt: null,
      done: true,
    });
  }

  if (bookingJson.status === BOOKING_STATUS.CANCELLED) {
    steps.push({
      key: 'cancelled',
      label: 'Cancelled',
      at: bookingJson.cancelledAt || null,
      dueAt: null,
      done: true,
    });
  }

  return steps;
}

function buildMeetPayload(booking, currentUserId) {
  const json = booking.toJSON ? booking.toJSON() : booking;
  const isSender = json.senderId === currentUserId;
  const myCode = isSender ? json.userMeetCode : json.companionMeetCode;
  const iVerifiedPeer = isSender
    ? !!json.companionCodeVerifiedAt
    : !!json.userCodeVerifiedAt;
  const peerVerifiedMe = isSender
    ? !!json.userCodeVerifiedAt
    : !!json.companionCodeVerifiedAt;
  return {
    myCode: myCode || null,
    iVerifiedPeer,
    peerVerifiedMe,
  };
}

function formatBooking(booking, currentUserId, extras = {}) {
  const json = booking.toJSON ? booking.toJSON() : booking;
  const isSender = json.senderId === currentUserId;
  const direction = extras.direction || (isSender ? 'sent' : 'received');
  const counterpartUser = isSender ? json.receiver : json.sender;
  const category = json.category
    ? {
        id: json.category.id,
        name: json.category.name,
        emoji: json.category.emoji,
      }
    : null;

  const reqForTimeline = extras.timelineRequest || extras.myRequest || null;
  const viewer = direction === 'sent' ? 'sender' : 'receiver';
  let timeline;
  if (direction === 'sent' && !reqForTimeline) {
    timeline = buildSenderBookingTimeline(
      json,
      Array.isArray(extras.acceptedResponses) ? extras.acceptedResponses.length : 0
    );
  } else {
    timeline = buildTimeline(
      json,
      reqForTimeline
        ? typeof reqForTimeline.toJSON === 'function'
          ? reqForTimeline.toJSON()
          : reqForTimeline
        : extras.requestTimeline || null,
      viewer
    );
  }

  return {
    id: json.id,
    status: json.status,
    scheduledAt: json.scheduledAt,
    durationMinutes: json.durationMinutes,
    location: json.location,
    placeId: json.placeId || null,
    locationLat: json.locationLat != null ? Number(json.locationLat) : null,
    locationLng: json.locationLng != null ? Number(json.locationLng) : null,
    notes: json.notes,
    cityId: json.cityId,
    categoryId: json.categoryId || null,
    category,
    preferredGender: json.preferredGender || null,
    bookingPolicyAccepted: !!json.bookingPolicyAccepted,
    amount: json.amount ?? null,
    paymentStatus: json.paymentStatus || 'unpaid',
    paidAt: json.paidAt || null,
    confirmedAt: json.confirmedAt || null,
    paymentDueAt: json.paymentDueAt || null,
    cancelledAt: json.cancelledAt || null,
    cancelReason: json.cancelReason || null,
    startedAt: json.startedAt || null,
    endsAt: json.endsAt || null,
    direction,
    counterpart: formatUserBrief(counterpartUser),
    senderId: json.senderId,
    receiverId: json.receiverId,
    requestId: extras.requestId || null,
    requestStatus: extras.requestStatus || null,
    offeredAmount: extras.offeredAmount ?? null,
    respondBy: extras.respondBy || null,
    acceptedAt: extras.acceptedAt || null,
    selectedAt: extras.selectedAt || null,
    isOpenRequest: !!extras.isOpenRequest,
    acceptedResponses: extras.acceptedResponses || undefined,
    myRequest: extras.myRequest || undefined,
    timeline,
    pricing: {
      defaultAmount: BOOKING_AMOUNT.DEFAULT,
      minAmount: BOOKING_AMOUNT.MIN,
      maxAmount: BOOKING_AMOUNT.MAX,
    },
    deadlines: {
      respondMs: BOOKING_DEADLINE_MS,
      paymentMs: BOOKING_DEADLINE_MS,
    },
    meet: buildMeetPayload(booking, currentUserId),
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

const bookingInclude = [
  { model: User, as: 'sender', attributes: counterpartAttributes },
  { model: User, as: 'receiver', attributes: counterpartAttributes, required: false },
  {
    model: CompanionCategory,
    as: 'category',
    attributes: ['id', 'name', 'emoji'],
    required: false,
  },
];

const requestIncludeReceiver = [
  { model: User, as: 'receiver', attributes: counterpartAttributes },
];

async function findEligibleRecipients({ senderId, cityId, preferredGender }) {
  const where = {
    id: { [Op.ne]: senderId },
    cityId,
    isActive: true,
    accountStatus: 'active',
    hasCompanionProfile: true,
  };
  if (preferredGender && preferredGender !== 'all') {
    where.gender = preferredGender;
  }
  return User.findAll({
    where,
    attributes: ['id', 'firstName', 'lastName', 'gender', 'cityId'],
  });
}

async function loadAcceptedResponses(bookingId, bookingJson = null) {
  const rows = await BookingRequest.findAll({
    where: {
      bookingId,
      status: {
        [Op.in]: [
          BOOKING_REQUEST_STATUS.ACCEPTED,
          BOOKING_REQUEST_STATUS.SELECTED,
        ],
      },
    },
    include: requestIncludeReceiver,
    order: [['acceptedAt', 'ASC']],
  });
  const booking =
    bookingJson ||
    (await Booking.findByPk(bookingId))?.toJSON?.() ||
    (await Booking.findByPk(bookingId));
  const bJson = booking?.toJSON ? booking.toJSON() : booking;
  return rows.map((req) => formatRequest(req, bJson, 'sender'));
}

async function enrichBookingDetail(booking, userId) {
  const bookingJson = booking.toJSON ? booking.toJSON() : booking;
  const acceptedResponses =
    booking.senderId === userId
      ? await loadAcceptedResponses(booking.id, bookingJson)
      : undefined;

  let myRequest = null;
  const req = await BookingRequest.findOne({
    where: { bookingId: booking.id, receiverId: userId },
    include: requestIncludeReceiver,
  });
  if (req) myRequest = formatRequest(req, bookingJson, 'receiver');

  return formatBooking(booking, userId, {
    acceptedResponses,
    myRequest,
    requestId: req?.id || null,
    requestStatus: req?.status || null,
    offeredAmount: req?.offeredAmount ?? null,
    respondBy: req?.respondBy || null,
    acceptedAt: req?.acceptedAt || null,
    selectedAt: req?.selectedAt || null,
    timelineRequest: myRequest,
    isOpenRequest: !booking.receiverId && !!req,
  });
}

async function createBooking(senderId, body) {
  const {
    receiverId,
    scheduledAt,
    durationMinutes,
    location,
    notes,
    cityId,
    categoryId,
    preferredGender,
    bookingPolicyAccepted,
    placeId: placeIdRaw,
    googlePlaceId,
    locationLat: locationLatRaw,
    locationLng: locationLngRaw,
  } = body;

  if (!scheduledAt) throw new AppError('scheduledAt is required', 400);

  if (!bookingPolicyAccepted) {
    throw new AppError('You must accept the terms to create a booking', 400);
  }

  const { useFree: useFreeCreate } = await entitlements.assertCanUse(senderId, 'create');

  const isOpenBooking = !receiverId;
  if (isOpenBooking) {
    if (!categoryId) throw new AppError('categoryId is required for open bookings', 400);
    if (!cityId) throw new AppError('cityId is required for open bookings', 400);
  } else if (senderId === receiverId) {
    throw new AppError('You cannot book yourself', 400);
  }

  if (receiverId) {
    const receiver = await User.findOne({
      where: {
        id: receiverId,
        isActive: true,
        accountStatus: 'active',
        hasCompanionProfile: true,
      },
    });
    if (!receiver) throw new AppError('Receiver not found or not available', 404);
  }

  let category = null;
  if (categoryId) {
    category = await CompanionCategory.findOne({
      where: { id: categoryId, isActive: true },
    });
    if (!category) throw new AppError('Invalid or inactive companion category', 400);
  }

  if (cityId) {
    const city = await City.findOne({ where: { id: cityId, isActive: true } });
    if (!city) throw new AppError('Invalid or inactive city', 400);
  }

  let genderValue = null;
  if (preferredGender != null && String(preferredGender).trim()) {
    genderValue = String(preferredGender).toLowerCase();
    if (!PREFERRED_GENDERS.includes(genderValue)) {
      throw new AppError('preferredGender must be all, male, or female', 400);
    }
  } else if (isOpenBooking) {
    genderValue = 'all';
  }

  const duration =
    durationMinutes !== undefined && durationMinutes !== null
      ? Number(durationMinutes)
      : 60;
  if (!Number.isFinite(duration) || duration < 1) {
    throw new AppError('durationMinutes must be a positive number', 400);
  }

  let locationValue = location != null ? String(location).trim() || null : null;
  let placeId = placeIdRaw ? String(placeIdRaw).trim() : null;
  if (!placeId && googlePlaceId) placeId = String(googlePlaceId).trim();
  let locationLat = parseCoord(locationLatRaw);
  let locationLng = parseCoord(locationLngRaw);

  if (isOpenBooking || locationValue || placeId) {
    const area = await cityAreaService.findActiveArea(placeId, cityId || null);
    if (!area) {
      throw new AppError(
        cityId ? 'Select an area in this city from the list.' : 'Select an area from the list.',
        400
      );
    }
    placeId = area.id;
    locationLat = parseCoord(area.latitude);
    locationLng = parseCoord(area.longitude);
    locationValue = area.cityName ? `${area.name}, ${area.cityName}` : area.name;
  }

  if (isOpenBooking && !locationValue) {
    throw new AppError('location is required', 400);
  }

  let notesValue = null;
  if (notes != null && String(notes).trim()) {
    notesValue = String(notes).trim().slice(0, 500);
  }

  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) throw new AppError('Invalid scheduledAt', 400);
  // Reject past times (1 minute grace for clock skew)
  if (when.getTime() < Date.now() - 60_000) {
    throw new AppError('scheduledAt must be in the future', 400);
  }

  // Pre-check open booking has eligible companions (avoid zombie pending with 0 requests)
  let openRecipients = [];
  if (isOpenBooking) {
    openRecipients = await findEligibleRecipients({
      senderId,
      cityId,
      preferredGender: genderValue,
    });
    if (!openRecipients.length) {
      throw new AppError(
        'No companions available matching this city and gender. Try another city or gender.',
        400
      );
    }
  }

  const sender = await User.findByPk(senderId, {
    attributes: ['id', 'firstName', 'lastName'],
  });
  const senderName = sender
    ? [sender.firstName, sender.lastName].filter(Boolean).join(' ').trim()
    : 'Someone';

  const result = await sequelize.transaction(async (transaction) => {
    if (useFreeCreate) {
      await entitlements.consumeFreeCredit(senderId, 'create', { transaction });
    }
    const booking = await Booking.create(
      {
        senderId,
        receiverId: receiverId || null,
        status: BOOKING_STATUS.PENDING,
        scheduledAt: when,
        durationMinutes: duration,
        location: locationValue,
        placeId: placeId || null,
        locationLat,
        locationLng,
        notes: notesValue,
        cityId: cityId || null,
        categoryId: categoryId || null,
        preferredGender: genderValue,
        bookingPolicyAccepted: true,
        paymentStatus: 'unpaid',
      },
      { transaction }
    );

    const pendingNotifications = [];
    const catLabel = category
      ? `${category.emoji || ''} ${category.name}`.trim()
      : 'Companion';
    const whenLabel = formatWhen(when);
    const title = `New booking request: ${catLabel}`;
    const bodyText = `${senderName} · ${locationValue || 'Location TBD'} · ${whenLabel}`;

    if (isOpenBooking) {
      await BookingRequest.bulkCreate(
        openRecipients.map((u) => ({
          bookingId: booking.id,
          receiverId: u.id,
          status: BOOKING_REQUEST_STATUS.PENDING,
          respondBy: deadlineFrom(),
        })),
        { transaction }
      );
      for (const u of openRecipients) {
        const notif = await createAndEmitNotification({
          recipientId: u.id,
          type: 'new_booking',
          title,
          body: bodyText,
          data: {
            bookingId: booking.id,
            senderId,
            categoryId: categoryId || null,
            scheduledAt: when.toISOString(),
            direct: false,
          },
          transaction,
        });
        if (notif) pendingNotifications.push(notif);
      }
    } else {
      await BookingRequest.create(
        {
          bookingId: booking.id,
          receiverId,
          status: BOOKING_REQUEST_STATUS.PENDING,
          respondBy: deadlineFrom(),
        },
        { transaction }
      );
      const notif = await createAndEmitNotification({
        recipientId: receiverId,
        type: 'new_booking',
        title,
        body: bodyText,
        data: {
          bookingId: booking.id,
          senderId,
          categoryId: categoryId || null,
          scheduledAt: when.toISOString(),
          direct: true,
        },
        transaction,
      });
      if (notif) pendingNotifications.push(notif);
    }

    await booking.reload({ include: bookingInclude, transaction });
    return { booking, pendingNotifications };
  });

  for (const n of result.pendingNotifications) {
    await emitExistingNotification(n);
    emitToUser(n.recipientId, 'booking:new', { bookingId: result.booking.id });
  }

  return enrichBookingDetail(result.booking, senderId);
}

async function listBookings(userId, tab) {
  await expireBookingDeadlines();
  const normalizedTab = String(tab || 'upcoming').toLowerCase();
  const todayStart = startOfTodayIst();

  if (normalizedTab === 'requests') {
    const sentRows = await Booking.findAll({
      where: {
        senderId: userId,
        status: {
          [Op.in]: [
            BOOKING_STATUS.PENDING,
            BOOKING_STATUS.RESPONSES_AVAILABLE,
            BOOKING_STATUS.PAYMENT_PENDING,
          ],
        },
      },
      include: bookingInclude,
      order: [['scheduledAt', 'ASC']],
    });

    const requestRows = await BookingRequest.findAll({
      where: {
        receiverId: userId,
        status: {
          [Op.in]: [
            BOOKING_REQUEST_STATUS.PENDING,
            BOOKING_REQUEST_STATUS.ACCEPTED,
            BOOKING_REQUEST_STATUS.SELECTED,
          ],
        },
      },
      include: [
        {
          model: Booking,
          as: 'booking',
          required: true,
          where: {
            status: {
              [Op.in]: [
                BOOKING_STATUS.PENDING,
                BOOKING_STATUS.RESPONSES_AVAILABLE,
                BOOKING_STATUS.PAYMENT_PENDING,
              ],
            },
          },
          include: bookingInclude,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const received = [];
    for (const req of requestRows) {
      if (!req.booking) continue;
      const bookingJson = req.booking.toJSON ? req.booking.toJSON() : req.booking;
      received.push(
        formatBooking(req.booking, userId, {
          direction: 'received',
          requestId: req.id,
          requestStatus: req.status,
          offeredAmount: req.offeredAmount ?? null,
          respondBy: req.respondBy || null,
          acceptedAt: req.acceptedAt || null,
          selectedAt: req.selectedAt || null,
          timelineRequest: formatRequest(req, bookingJson, 'receiver'),
          isOpenRequest: !req.booking.receiverId,
        })
      );
    }

    const sent = [];
    for (const b of sentRows) {
      const bookingJson = b.toJSON ? b.toJSON() : b;
      const acceptedResponses = await loadAcceptedResponses(b.id, bookingJson);
      sent.push(
        formatBooking(b, userId, {
          direction: 'sent',
          acceptedResponses,
        })
      );
    }

    return { received, sent };
  }

  if (normalizedTab === 'upcoming') {
    const rows = await Booking.findAll({
      where: {
        status: {
          [Op.in]: [
            BOOKING_STATUS.CONFIRMED,
            BOOKING_STATUS.IN_PROGRESS,
            BOOKING_STATUS.ACCEPTED,
          ],
        },
        scheduledAt: { [Op.gte]: todayStart },
        [Op.or]: [{ senderId: userId }, { receiverId: userId }],
      },
      include: bookingInclude,
      order: [['scheduledAt', 'ASC']],
    });
    return { items: rows.map((b) => formatBooking(b, userId)) };
  }

  if (normalizedTab === 'past') {
    const rows = await Booking.findAll({
      where: {
        [Op.or]: [
          {
            [Op.or]: [{ senderId: userId }, { receiverId: userId }],
            status: {
              [Op.in]: [
                BOOKING_STATUS.DECLINED,
                BOOKING_STATUS.CANCELLED,
                BOOKING_STATUS.COMPLETED,
              ],
            },
          },
          {
            [Op.or]: [{ senderId: userId }, { receiverId: userId }],
            status: {
              [Op.in]: [
                BOOKING_STATUS.CONFIRMED,
                BOOKING_STATUS.IN_PROGRESS,
                BOOKING_STATUS.ACCEPTED,
              ],
            },
            scheduledAt: { [Op.lt]: todayStart },
          },
        ],
      },
      include: bookingInclude,
      order: [['scheduledAt', 'DESC']],
    });
    return { items: rows.map((b) => formatBooking(b, userId)) };
  }

  throw new AppError('Invalid tab. Use upcoming, requests, or past', 400);
}

async function getBookingById(userId, bookingId) {
  await expireBookingDeadlines();

  const booking = await Booking.findByPk(bookingId, { include: bookingInclude });
  if (!booking) throw new AppError('Booking not found', 404);

  const isParty =
    booking.senderId === userId || booking.receiverId === userId;
  if (!isParty) {
    const req = await BookingRequest.findOne({
      where: { bookingId, receiverId: userId },
    });
    if (!req) throw new AppError('Not allowed to access this booking', 403);
  }

  return enrichBookingDetail(booking, userId);
}

/** Receiver enters amount (default 99, min 99, max 1500) and accepts offer */
async function respondToBooking(userId, bookingId, { action, amount } = {}) {
  await expireBookingDeadlines();

  const normalized = String(action || '').toLowerCase();
  const isApprove = ['approve', 'accept', 'approved'].includes(normalized);
  const isReject = ['reject', 'decline', 'declined'].includes(normalized);
  if (!isApprove && !isReject) {
    throw new AppError('action must be approve or reject', 400);
  }
  const { useFree: useFreeAccept } = isApprove
    ? await entitlements.assertCanUse(userId, 'accept')
    : { useFree: false };

  const booking = await Booking.findByPk(bookingId, { include: bookingInclude });
  if (!booking) throw new AppError('Booking not found', 404);
  if (
    ![BOOKING_STATUS.PENDING, BOOKING_STATUS.RESPONSES_AVAILABLE].includes(booking.status)
  ) {
    throw new AppError('Booking is not open for responses', 400);
  }

  const req = await BookingRequest.findOne({
    where: {
      bookingId,
      receiverId: userId,
      status: BOOKING_REQUEST_STATUS.PENDING,
    },
  });
  if (!req) throw new AppError('No pending request found for you', 404);

  if (req.respondBy && new Date(req.respondBy).getTime() < Date.now()) {
    req.status = BOOKING_REQUEST_STATUS.EXPIRED;
    req.respondedAt = new Date();
    await req.save();
    throw new AppError('Accept window expired (1 hour). Request cancelled.', 400);
  }

  if (isReject) {
    req.status = BOOKING_REQUEST_STATUS.DECLINED;
    req.respondedAt = new Date();
    await req.save();

    await createAndEmitNotification({
      recipientId: booking.senderId,
      type: 'booking_declined',
      title: 'Booking declined',
      body: 'Someone declined your booking request',
      data: { bookingId: booking.id },
    });

    const cancelled = await cancelOpenBookingIfNoActive(booking, {
      reason: 'all_declined',
      title: 'Booking cancelled',
      body: 'All companions declined. Booking was cancelled.',
    });
    if (!cancelled) {
      emitToUser(booking.senderId, 'booking:updated', { bookingId: booking.id });
    }

    await booking.reload({ include: bookingInclude });
    return enrichBookingDetail(booking, userId);
  }

  const offered = parseAmount(
    amount == null || amount === '' ? BOOKING_AMOUNT.DEFAULT : amount
  );
  const now = new Date();

  if (useFreeAccept) {
    await entitlements.consumeFreeCredit(userId, 'accept');
  }

  req.status = BOOKING_REQUEST_STATUS.ACCEPTED;
  req.offeredAmount = offered;
  req.acceptedAt = now;
  req.respondedAt = now;
  await req.save();

  // Direct invite (receiver already set) → start 1h payment window immediately
  const isDirect = booking.receiverId && String(booking.receiverId) === String(userId);
  if (isDirect) {
    booking.amount = offered;
    booking.status = BOOKING_STATUS.PAYMENT_PENDING;
    booking.paymentStatus = 'unpaid';
    booking.paymentDueAt = deadlineFrom(now);
    await booking.save();

    req.status = BOOKING_REQUEST_STATUS.SELECTED;
    req.selectedAt = now;
    await req.save();
  } else if (booking.status === BOOKING_STATUS.PENDING) {
    booking.status = BOOKING_STATUS.RESPONSES_AVAILABLE;
    await booking.save();
  }

  const me = await User.findByPk(userId, { attributes: ['firstName', 'lastName'] });
  const name = me
    ? [me.firstName, me.lastName].filter(Boolean).join(' ').trim()
    : 'Someone';

  if (isDirect) {
    await createAndEmitNotification({
      recipientId: booking.senderId,
      type: 'booking_response',
      title: 'Accepted — pay within 1 hour',
      body: `${name} accepted · ₹${offered}. Pay & confirm within 1 hour.`,
      data: {
        bookingId: booking.id,
        requestId: req.id,
        amount: offered,
        paymentDueAt: deadlineFrom(now).toISOString(),
      },
    });
  } else {
    await createAndEmitNotification({
      recipientId: booking.senderId,
      type: 'booking_response',
      title: 'New response — select a companion',
      body: `${name} accepted · ₹${offered}. Select them, then pay within 1 hour of selection.`,
      data: {
        bookingId: booking.id,
        requestId: req.id,
        amount: offered,
      },
    });
  }
  emitToUser(booking.senderId, 'booking:updated', { bookingId: booking.id });

  await booking.reload({ include: bookingInclude });
  return enrichBookingDetail(booking, userId);
}

/** Creator picks a response → payment_pending (1 hour to pay from selection) */
async function selectBookingRequest(userId, bookingId, requestId) {
  await expireBookingDeadlines();
  if (!requestId) throw new AppError('requestId is required', 400);

  const now = new Date();
  let selectedReceiverId = null;
  let selectedAmount = null;
  let paymentDueAt = null;
  const notSelectedIds = [];

  await sequelize.transaction(async (transaction) => {
    const booking = await Booking.findByPk(bookingId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!booking) throw new AppError('Booking not found', 404);
    if (booking.senderId !== userId) {
      throw new AppError('Only the booking creator can select a response', 403);
    }
    if (
      ![BOOKING_STATUS.RESPONSES_AVAILABLE, BOOKING_STATUS.PENDING].includes(
        booking.status
      )
    ) {
      throw new AppError('Booking is not waiting for selection', 400);
    }

    const req = await BookingRequest.findOne({
      where: {
        id: requestId,
        bookingId,
        status: BOOKING_REQUEST_STATUS.ACCEPTED,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!req) throw new AppError('Accepted response not found', 404);
    if (!req.offeredAmount) throw new AppError('Response has no amount', 400);

    // Stale accept offers (>1h) cannot be selected
    if (
      req.acceptedAt &&
      new Date(req.acceptedAt).getTime() + BOOKING_DEADLINE_MS < now.getTime()
    ) {
      req.status = BOOKING_REQUEST_STATUS.EXPIRED;
      req.respondedAt = now;
      await req.save({ transaction });
      throw new AppError(
        'This offer expired (1 hour from accept). Pick another response.',
        400
      );
    }

    // Pay window starts from selection (not accept)
    paymentDueAt = deadlineFrom(now);

    booking.receiverId = req.receiverId;
    booking.amount = req.offeredAmount;
    booking.status = BOOKING_STATUS.PAYMENT_PENDING;
    booking.paymentStatus = 'unpaid';
    booking.paymentDueAt = paymentDueAt;
    await booking.save({ transaction });

    req.status = BOOKING_REQUEST_STATUS.SELECTED;
    req.selectedAt = now;
    await req.save({ transaction });

    const others = await BookingRequest.findAll({
      where: {
        bookingId,
        id: { [Op.ne]: req.id },
        status: {
          [Op.in]: [
            BOOKING_REQUEST_STATUS.PENDING,
            BOOKING_REQUEST_STATUS.ACCEPTED,
          ],
        },
      },
      attributes: ['id', 'receiverId'],
      transaction,
    });
    for (const o of others) {
      notSelectedIds.push(o.receiverId);
    }

    await BookingRequest.update(
      { status: BOOKING_REQUEST_STATUS.EXPIRED, respondedAt: now },
      {
        where: {
          bookingId,
          id: { [Op.ne]: req.id },
          status: {
            [Op.in]: [
              BOOKING_REQUEST_STATUS.PENDING,
              BOOKING_REQUEST_STATUS.ACCEPTED,
            ],
          },
        },
        transaction,
      }
    );

    selectedReceiverId = req.receiverId;
    selectedAmount = req.offeredAmount;
  });

  await createAndEmitNotification({
    recipientId: selectedReceiverId,
    type: 'booking_selected',
    title: 'You were selected',
    body: `Waiting for payment of ₹${selectedAmount} (within 1 hour)`,
    data: {
      bookingId,
      amount: selectedAmount,
      paymentDueAt: paymentDueAt.toISOString(),
    },
  });
  emitToUser(selectedReceiverId, 'booking:updated', { bookingId });

  for (const rid of notSelectedIds) {
    await createAndEmitNotification({
      recipientId: rid,
      type: 'booking_not_selected',
      title: 'Not selected this time',
      body: 'The creator chose another companion for this booking.',
      data: { bookingId },
    });
    emitToUser(rid, 'booking:updated', { bookingId });
  }

  const booking = await Booking.findByPk(bookingId, { include: bookingInclude });
  return enrichBookingDetail(booking, userId);
}

function assertBookingPayable(booking, userId) {
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.senderId !== userId) {
    throw new AppError('Only the booking creator can pay', 403);
  }
  if (booking.status !== BOOKING_STATUS.PAYMENT_PENDING) {
    throw new AppError('Booking is not awaiting payment', 400);
  }
  if (booking.paymentDueAt && new Date(booking.paymentDueAt).getTime() < Date.now()) {
    throw new AppError('Payment window expired (1 hour). Booking cancelled.', 400);
  }
  if (!booking.receiverId || !booking.amount) {
    throw new AppError('Booking is missing receiver or amount', 400);
  }
}

/** Validates the booking can be paid now; returns it (used before creating a Razorpay order). */
async function getPayableBooking(userId, bookingId) {
  await expireBookingDeadlines();
  const booking = await Booking.findByPk(bookingId);
  assertBookingPayable(booking, userId);
  return booking;
}

async function markBookingPaid(booking, transaction) {
  booking.paymentStatus = 'paid';
  booking.paidAt = new Date();
  booking.confirmedAt = new Date();
  booking.status = BOOKING_STATUS.CONFIRMED;
  booking.paymentDueAt = null;
  await assignUniqueMeetCodes(booking, { transaction });
  await booking.save({ transaction });
}

/**
 * Razorpay payment captured → confirm booking. Caller owns the transaction.
 * Returns false when the booking can no longer be confirmed (caller refunds).
 */
async function confirmPaidOnline(userId, bookingId, { transaction, razorpayPaymentId, paymentOrderId }) {
  const booking = await Booking.findByPk(bookingId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!booking || booking.senderId !== userId) return false;
  if (booking.status !== BOOKING_STATUS.PAYMENT_PENDING) return false;
  if (!booking.receiverId || !booking.amount) return false;

  await walletService.createLedgerEntry({
    userId,
    type: walletService.WALLET_TX_TYPES.BOOKING_PAYMENT,
    direction: 'debit',
    amount: Number(booking.amount),
    title: 'Booking payment',
    body: `Paid ₹${booking.amount} online to confirm booking`,
    bookingId: booking.id,
    idempotencyKey: `booking_payment:${booking.id}:${userId}`,
    meta: { method: 'razorpay', razorpayPaymentId, paymentOrderId },
    affectsBalance: false,
    transaction,
  });
  await markBookingPaid(booking, transaction);
  return true;
}

async function notifyBookingConfirmed(bookingId, userId) {
  const booking = await Booking.findByPk(bookingId, { include: bookingInclude });

  await chatService.ensureConversationBetween(booking.senderId, booking.receiverId);

  await createAndEmitNotification({
    recipientId: booking.receiverId,
    type: 'booking_confirmed',
    title: 'Booking confirmed',
    body: `Payment received · ₹${booking.amount}. Meet codes are ready.`,
    data: { bookingId: booking.id },
  });
  emitToUser(booking.receiverId, 'booking:updated', { bookingId: booking.id });
  emitToUser(booking.senderId, 'booking:updated', { bookingId: booking.id });

  return enrichBookingDetail(booking, userId);
}

/** Creator pays from wallet → confirmed + meet codes */
async function confirmPayment(userId, bookingId) {
  await expireBookingDeadlines();

  await sequelize.transaction(async (transaction) => {
    const booking = await Booking.findByPk(bookingId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    assertBookingPayable(booking, userId);

    // Debit wallet first (throws Insufficient wallet balance)
    await walletService.recordBookingPayment(userId, booking, { transaction });
    await markBookingPaid(booking, transaction);
  });

  return notifyBookingConfirmed(bookingId, userId);
}

async function verifyMeetCode(userId, bookingId, code) {
  const raw = String(code || '')
    .trim()
    .toUpperCase();
  if (raw.length < 4 || raw.length > 12) {
    throw new AppError('Invalid meet code', 400);
  }

  let becameInProgress = false;
  let endsAt = null;
  let durationMinutes = 60;
  let receiverId = null;
  let amount = null;
  let senderId = null;

  await sequelize.transaction(async (transaction) => {
    const booking = await Booking.findByPk(bookingId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!booking) throw new AppError('Booking not found', 404);
    if (
      ![BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.IN_PROGRESS].includes(booking.status)
    ) {
      throw new AppError('Meet codes are not active for this booking', 400);
    }

    const isSender = booking.senderId === userId;
    const isReceiver = booking.receiverId === userId;
    if (!isSender && !isReceiver) {
      throw new AppError('Not allowed', 403);
    }

    if (isSender) {
      if (!booking.companionCodeVerifiedAt) {
        if (raw !== String(booking.companionMeetCode || '').toUpperCase()) {
          throw new AppError('Code does not match', 400);
        }
        booking.companionCodeVerifiedAt = new Date();
      }
    } else if (!booking.userCodeVerifiedAt) {
      if (raw !== String(booking.userMeetCode || '').toUpperCase()) {
        throw new AppError('Code does not match', 400);
      }
      booking.userCodeVerifiedAt = new Date();
    }

    const bothVerified =
      !!booking.userCodeVerifiedAt && !!booking.companionCodeVerifiedAt;
    becameInProgress =
      bothVerified && booking.status === BOOKING_STATUS.CONFIRMED;

    if (becameInProgress) {
      booking.status = BOOKING_STATUS.IN_PROGRESS;
      booking.startedAt = new Date();
      const ends = new Date(booking.startedAt);
      ends.setMinutes(ends.getMinutes() + (booking.durationMinutes || 60));
      booking.endsAt = ends;
    }

    await booking.save({ transaction });

    if (bothVerified && booking.receiverId && booking.amount) {
      await walletService.recordBookingEarning(booking.receiverId, booking, {
        transaction,
      });
    }

    endsAt = booking.endsAt;
    durationMinutes = booking.durationMinutes || 60;
    receiverId = booking.receiverId;
    amount = booking.amount;
    senderId = booking.senderId;
  });

  if (becameInProgress && receiverId && amount) {
    await createAndEmitNotification({
      recipientId: receiverId,
      type: 'wallet_credit',
      title: 'Wallet credited',
      body: `₹${amount} added to your wallet after meetup verification`,
      data: { bookingId, amount },
    });
  }

  if (becameInProgress) {
    const timerPayload = {
      bookingId,
      status: BOOKING_STATUS.IN_PROGRESS,
      endsAt,
    };
    await createAndEmitNotification({
      recipientId: senderId,
      type: 'booking_in_progress',
      title: 'Meetup started',
      body: `Session timer is running (${durationMinutes} min).`,
      data: timerPayload,
    });
    if (receiverId) {
      await createAndEmitNotification({
        recipientId: receiverId,
        type: 'booking_in_progress',
        title: 'Meetup started',
        body: `Session timer is running (${durationMinutes} min).`,
        data: timerPayload,
      });
    }
    emitToUser(senderId, 'booking:updated', timerPayload);
    if (receiverId) {
      emitToUser(receiverId, 'booking:updated', timerPayload);
    }
  } else {
    const booking = await Booking.findByPk(bookingId);
    const otherId =
      booking?.senderId === userId ? booking?.receiverId : booking?.senderId;
    if (otherId) {
      emitToUser(otherId, 'booking:updated', { bookingId });
    }
  }

  const booking = await Booking.findByPk(bookingId, { include: bookingInclude });
  return enrichBookingDetail(booking, userId);
}

/** Legacy accept — routes open bookings to respond with default amount */
async function acceptBooking(userId, bookingId, body = {}) {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);

  const openish =
    !booking.receiverId ||
    [BOOKING_STATUS.PENDING, BOOKING_STATUS.RESPONSES_AVAILABLE].includes(booking.status);

  if (openish) {
    return respondToBooking(userId, bookingId, {
      action: 'approve',
      amount: body.amount,
    });
  }

  if (booking.receiverId !== userId) {
    throw new AppError('Only the receiver can accept this booking', 403);
  }
  if (booking.status !== BOOKING_STATUS.PENDING) {
    throw new AppError('Only pending bookings can be accepted', 400);
  }
  const { useFree } = await entitlements.assertCanUse(userId, 'accept');
  if (useFree) await entitlements.consumeFreeCredit(userId, 'accept');

  booking.status = BOOKING_STATUS.ACCEPTED;
  await booking.save();
  await BookingRequest.update(
    { status: BOOKING_REQUEST_STATUS.ACCEPTED, respondedAt: new Date() },
    { where: { bookingId, receiverId: userId, status: BOOKING_REQUEST_STATUS.PENDING } }
  );
  await chatService.ensureConversationBetween(booking.senderId, booking.receiverId);
  await booking.reload({ include: bookingInclude });
  return enrichBookingDetail(booking, userId);
}

async function declineBooking(userId, bookingId) {
  return respondToBooking(userId, bookingId, { action: 'reject' });
}

async function cancelBooking(userId, bookingId) {
  await expireBookingDeadlines();

  const booking = await Booking.findByPk(bookingId, { include: bookingInclude });
  if (!booking) throw new AppError('Booking not found', 404);

  const isSender = booking.senderId === userId;
  const isReceiver = booking.receiverId === userId;
  if (!isSender && !isReceiver) {
    const pendingReq = await BookingRequest.findOne({
      where: {
        bookingId,
        receiverId: userId,
        status: BOOKING_REQUEST_STATUS.PENDING,
      },
    });
    if (pendingReq) return respondToBooking(userId, bookingId, { action: 'reject' });

    // Companion can withdraw an accepted (not yet selected) offer
    const acceptedReq = await BookingRequest.findOne({
      where: {
        bookingId,
        receiverId: userId,
        status: BOOKING_REQUEST_STATUS.ACCEPTED,
      },
    });
    if (acceptedReq) {
      acceptedReq.status = BOOKING_REQUEST_STATUS.CANCELLED;
      acceptedReq.respondedAt = new Date();
      await acceptedReq.save();
      await createAndEmitNotification({
        recipientId: booking.senderId,
        type: 'booking_declined',
        title: 'Offer withdrawn',
        body: 'A companion withdrew their accepted offer',
        data: { bookingId: booking.id },
      });
      await cancelOpenBookingIfNoActive(booking, {
        reason: 'all_declined',
        title: 'Booking cancelled',
        body: 'No companions remain for this booking.',
      });
      emitToUser(booking.senderId, 'booking:updated', { bookingId: booking.id });
      await booking.reload({ include: bookingInclude });
      return enrichBookingDetail(booking, userId);
    }

    throw new AppError('Not allowed to cancel this booking', 403);
  }

  if (booking.status === BOOKING_STATUS.IN_PROGRESS) {
    throw new AppError('Cannot cancel a booking in progress', 400);
  }
  if (booking.status === BOOKING_STATUS.COMPLETED) {
    throw new AppError('Cannot cancel a completed booking', 400);
  }
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    throw new AppError('Booking is already cancelled', 400);
  }

  const wasPaid =
    booking.paymentStatus === 'paid' || !!booking.paidAt;

  await sequelize.transaction(async (transaction) => {
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancelledAt = new Date();
    booking.cancelReason = 'user_cancelled';
    await booking.save({ transaction });

    await BookingRequest.update(
      { status: BOOKING_REQUEST_STATUS.CANCELLED, respondedAt: new Date() },
      {
        where: {
          bookingId,
          status: { [Op.in]: ACTIVE_REQUEST_STATUSES },
        },
        transaction,
      }
    );

    // Refund wallet debit if cancelled after payment (earning only happens after meet verify)
    if (wasPaid) {
      await walletService.refundBookingPayment(booking.senderId, booking, {
        transaction,
        reason: 'user_cancelled',
      });
      booking.paymentStatus = 'refunded';
      await booking.save({ transaction });
    }
  });

  const notifyId = isSender ? booking.receiverId : booking.senderId;
  if (notifyId) {
    await createAndEmitNotification({
      recipientId: notifyId,
      type: 'booking_cancelled',
      title: 'Booking cancelled',
      body: wasPaid
        ? 'A booking was cancelled. Payment has been refunded.'
        : 'A booking was cancelled',
      data: { bookingId: booking.id },
    });
    emitToUser(notifyId, 'booking:updated', { bookingId: booking.id });
  }

  // Also notify pending open-request companions when creator cancels early
  if (isSender && !booking.receiverId) {
    const pendingReqs = await BookingRequest.findAll({
      where: { bookingId, status: BOOKING_REQUEST_STATUS.CANCELLED },
      attributes: ['receiverId'],
      limit: 50,
    });
    for (const r of pendingReqs) {
      if (!r.receiverId || r.receiverId === notifyId) continue;
      emitToUser(r.receiverId, 'booking:updated', { bookingId: booking.id });
    }
  }

  await booking.reload({ include: bookingInclude });
  return enrichBookingDetail(booking, userId);
}

async function listAllBookingsAdmin() {
  const rows = await Booking.findAll({
    include: [
      ...bookingInclude,
      { model: City, as: 'city', attributes: ['id', 'name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
  });

  return rows.map((b) => {
    const json = b.toJSON();
    return {
      id: json.id,
      status: json.status,
      scheduledAt: json.scheduledAt,
      durationMinutes: json.durationMinutes,
      location: json.location,
      notes: json.notes,
      amount: json.amount,
      paymentStatus: json.paymentStatus,
      cityId: json.cityId,
      cityName: json.city ? json.city.name : null,
      categoryId: json.categoryId || null,
      categoryName: json.category ? json.category.name : null,
      preferredGender: json.preferredGender || null,
      sender: formatUserBrief(json.sender),
      receiver: formatUserBrief(json.receiver),
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    };
  });
}

module.exports = {
  createBooking,
  listBookings,
  getBookingById,
  respondToBooking,
  selectBookingRequest,
  confirmPayment,
  getPayableBooking,
  confirmPaidOnline,
  notifyBookingConfirmed,
  verifyMeetCode,
  acceptBooking,
  declineBooking,
  cancelBooking,
  listAllBookingsAdmin,
};
