const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const { User, City } = require('../../../models');
const AppError = require('../../../utils/AppError');
const { assertMeetsAgeRequirement, GENDERS } = require('../../../utils/ageRequirements');
const {
  signMobileVerifiedToken,
  signGoogleVerifiedToken,
  verifyToken,
} = require('../../../utils/jwt');
const { verifyGoogleIdToken } = require('../../firebaseAuthService');
const otpService = require('./otpService');
const deviceSessionService = require('./deviceSessionService');
const normalizeMobile = require('../../../utils/normalizeMobile');
const { RELIGIONS, normalizeReligion } = require('../../../constants/religions');
const coinService = require('./coinService');
const { formatProfile } = require('./profileService');

function formatUser(user) {
  return formatProfile(user);
}

async function requestOtp(mobileNumber) {
  const result = otpService.requestOtp(mobileNumber);
  return result;
}

async function loginExistingUser(user, deviceMeta) {
  if (String(user.mobileNumber || '').startsWith('deleted:')) {
    throw new AppError('This account has been deleted', 403);
  }
  if (user.accountStatus === 'blocked' || user.accountStatus === 'suspended') {
    throw new AppError('Account is not accessible. Contact support.', 403);
  }
  // Deactivated accounts reactivate on successful login
  if (!user.isActive || user.accountStatus === 'inactive') {
    user.isActive = true;
    user.accountStatus = 'active';
    await user.save({ fields: ['isActive', 'accountStatus'] });
  }
  const { token } = await deviceSessionService.createSessionAndToken(user.id, deviceMeta);
  return {
    needsRegistration: false,
    token,
    user: formatUser(user),
  };
}

async function verifyOtp(mobileNumber, otp, deviceMeta = {}) {
  const normalized = otpService.verifyOtp(mobileNumber, otp);
  const user = await User.findOne({
    where: { mobileNumber: normalized },
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });

  if (user) {
    return loginExistingUser(user, deviceMeta);
  }

  const mobileVerifiedToken = signMobileVerifiedToken(normalized);
  return {
    needsRegistration: true,
    mobileVerifiedToken,
    mobileNumber: normalized,
  };
}

/**
 * Existing account: matched by linked Google UID, else by email (linked on first Google login).
 * New Google user: returns a short-lived token to finish signup on the register screen.
 */
async function googleLogin(idToken, deviceMeta = {}) {
  const google = await verifyGoogleIdToken(idToken);
  const cityInclude = [{ model: City, as: 'city', attributes: ['id', 'name'] }];

  let user = await User.findOne({ where: { googleUid: google.uid }, include: cityInclude });

  if (!user) {
    // Profile emails aren't verified, so only link when exactly one account claims this email.
    const byEmail = await User.findAll({
      where: {
        [Op.and]: [
          sequelizeWhere(fn('lower', col('email')), google.email),
          { googleUid: null },
        ],
      },
      include: cityInclude,
      limit: 2,
    });
    if (byEmail.length === 1) {
      user = byEmail[0];
      user.googleUid = google.uid;
      await user.save({ fields: ['googleUid'] });
    }
  }

  if (user) {
    return loginExistingUser(user, deviceMeta);
  }

  return {
    needsRegistration: true,
    googleVerifiedToken: signGoogleVerifiedToken(google),
    profile: {
      email: google.email,
      firstName: google.firstName,
      lastName: google.lastName,
      photoUrl: google.photoUrl,
    },
  };
}

function getGoogleFromVerifiedToken(googleVerifiedToken) {
  let decoded;
  try {
    decoded = verifyToken(googleVerifiedToken);
  } catch {
    throw new AppError('Google sign-in expired. Please continue with Google again.', 401);
  }
  if (decoded.purpose !== 'google_registration' || !decoded.googleUid || !decoded.email) {
    throw new AppError('Invalid Google verification token', 401);
  }
  return { uid: decoded.googleUid, email: decoded.email };
}

function getMobileFromVerifiedToken(mobileVerifiedToken) {
  if (!mobileVerifiedToken) {
    throw new AppError('mobileVerifiedToken is required', 400);
  }
  let decoded;
  try {
    decoded = verifyToken(mobileVerifiedToken);
  } catch {
    throw new AppError('Invalid or expired mobile verification token', 401);
  }
  if (decoded.purpose !== 'registration' || !decoded.mobileNumber) {
    throw new AppError('Invalid mobile verification token', 401);
  }
  return decoded.mobileNumber;
}

async function register(body) {
  const {
    mobileVerifiedToken,
    googleVerifiedToken,
    firstName,
    lastName,
    gender,
    dateOfBirth,
    cityId,
    pincode,
    email,
    religion,
    termsAccepted,
  } = body;

  // Older app builds don't send the flag, so only an explicit refusal is rejected.
  if (termsAccepted === false) {
    throw new AppError('Please confirm your age and accept the Terms & Conditions', 400);
  }

  if (!firstName || !lastName || !gender || !dateOfBirth || !cityId || !religion) {
    throw new AppError(
      'firstName, lastName, gender, dateOfBirth, religion, and cityId are required',
      400
    );
  }

  const normalizedReligion = normalizeReligion(religion);
  if (!normalizedReligion) {
    throw new AppError(`Invalid religion. Allowed: ${RELIGIONS.join(', ')}`, 400);
  }

  const pin = pincode != null ? String(pincode).replace(/\D/g, '') : '';
  if (!pin || pin.length !== 6) {
    throw new AppError('Pincode must be 6 digits', 400);
  }

  let mobileNumber = null;
  let google = null;
  if (googleVerifiedToken && !mobileVerifiedToken) {
    google = getGoogleFromVerifiedToken(googleVerifiedToken);
  } else {
    mobileNumber = getMobileFromVerifiedToken(mobileVerifiedToken);
    normalizeMobile(mobileNumber);
  }

  if (!GENDERS.includes(String(gender).toLowerCase())) {
    throw new AppError('Invalid gender. Allowed: male, female, other', 400);
  }
  const normalizedGender = String(gender).toLowerCase();

  assertMeetsAgeRequirement(normalizedGender, dateOfBirth);

  const city = await City.findOne({ where: { id: cityId, isActive: true } });
  if (!city) {
    throw new AppError('Invalid or inactive city', 400);
  }

  if (google) {
    const existing = await User.findOne({ where: { googleUid: google.uid } });
    if (existing) {
      throw new AppError('An account already exists for this Google account. Please log in.', 409);
    }
  } else {
    const existing = await User.findOne({ where: { mobileNumber } });
    if (existing) {
      throw new AppError('User already registered with this mobile number', 409);
    }
  }

  const accountEmail = google ? google.email : email;

  const user = await User.create({
    mobileNumber,
    googleUid: google ? google.uid : null,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    gender: normalizedGender,
    dateOfBirth,
    religion: normalizedReligion,
    cityId,
    pincode: pin || null,
    email: accountEmail ? String(accountEmail).trim().toLowerCase() : null,
    termsAcceptedAt: termsAccepted === true ? new Date() : null,
    isActive: true,
    hasUserProfile: true,
    hasCompanionProfile: true,
    onboardingStep: 2,
    onboardingCompleted: false,
  });

  await coinService.grantSignupBonus(user.id).catch((err) =>
    console.error('[coins] signup bonus failed', user.id, err.message)
  );

  await user.reload({
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });

  const { token } = await deviceSessionService.createSessionAndToken(
    user.id,
    body.deviceMeta || {}
  );
  return {
    token,
    user: formatUser(user),
    profilesCreated: { user: true, companion: true },
    isNewAccount: true,
  };
}

async function getMe(userId) {
  const user = await User.findByPk(userId, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403);
  }
  return formatUser(user);
}

async function ensureSession(userId, currentSid, deviceMeta = {}) {
  const { DeviceSession } = require('../../../models');
  if (currentSid) {
    const existing = await DeviceSession.findByPk(currentSid);
    if (existing && existing.userId === userId && !existing.revokedAt) {
      await deviceSessionService.registerOrUpdateDevice(userId, currentSid, deviceMeta);
      return { rotated: false, token: null };
    }
  }
  const { token } = await deviceSessionService.createSessionAndToken(userId, deviceMeta);
  return { rotated: true, token };
}

const LINK_MOBILE_PURPOSE = 'link_mobile';

async function assertMobileAvailable(userId, mobile) {
  const owner = await User.findOne({ where: { mobileNumber: mobile }, attributes: ['id'] });
  if (owner && owner.id !== userId) {
    throw new AppError('This mobile number is already linked to another account', 409);
  }
}

/** Google sign-ups add (or change) their mobile number later with an OTP. */
async function requestLinkMobileOtp(userId, mobileNumber) {
  const mobile = normalizeMobile(mobileNumber);
  await assertMobileAvailable(userId, mobile);
  return otpService.requestOtp(mobile, LINK_MOBILE_PURPOSE);
}

async function verifyLinkMobile(userId, mobileNumber, otp) {
  const mobile = otpService.verifyOtp(mobileNumber, otp, LINK_MOBILE_PURPOSE);
  await assertMobileAvailable(userId, mobile);
  const user = await User.findByPk(userId, {
    include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
  });
  if (!user) throw new AppError('User not found', 404);
  user.mobileNumber = mobile;
  await user.save({ fields: ['mobileNumber'] });
  return formatUser(user);
}

module.exports = {
  requestOtp,
  verifyOtp,
  googleLogin,
  requestLinkMobileOtp,
  verifyLinkMobile,
  register,
  getMe,
  ensureSession,
};
