const env = require('../../../config/env');
const AppError = require('../../../utils/AppError');
const normalizeMobile = require('../../../utils/normalizeMobile');
const smsService = require('../../smsService');

/** @type {Map<string, { otp: string, expiresAt: number, sentAt: number }>} */
const otpStore = new Map();

const OTP_TTL_MS = env.sms.otpValidityMinutes * 60 * 1000;
/** Stops repeat taps / scripts from burning SMS credits. */
const RESEND_COOLDOWN_MS = 30 * 1000;

function storeKey(mobileNumber, purpose = 'login') {
  return `${purpose}:${mobileNumber}`;
}

function isDemoNumber(mobileNumber) {
  return !!env.otp.demoOtp && env.otp.demoNumbers.includes(String(mobileNumber).slice(-10));
}

function generateOtp() {
  // Without an SMS gateway the user can only log in with the master code.
  if (!smsService.isEnabled() && env.otp.masterEnabled) {
    return env.otp.devOtp;
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function requestOtp(mobileNumber, purpose = 'login') {
  const normalized = normalizeMobile(mobileNumber);
  const key = storeKey(normalized, purpose);
  if (isDemoNumber(normalized)) {
    // Shared by every tester, so nobody may deactivate or delete it.
    if (purpose !== 'login') {
      throw new AppError('The demo account cannot be deactivated or deleted.', 403);
    }
    const now = Date.now();
    otpStore.set(key, { otp: env.otp.demoOtp, expiresAt: now + OTP_TTL_MS, sentAt: now });
    return { mobileNumber: normalized, message: 'OTP sent successfully' };
  }
  const existing = otpStore.get(key);
  if (existing && Date.now() - existing.sentAt < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.sentAt)) / 1000);
    throw new AppError(`Please wait ${wait}s before requesting another OTP.`, 429);
  }

  const otp = generateOtp();
  const now = Date.now();
  otpStore.set(key, { otp, expiresAt: now + OTP_TTL_MS, sentAt: now });

  if (smsService.isEnabled()) {
    try {
      await smsService.sendOtpSms(normalized, otp, purpose);
    } catch (err) {
      otpStore.delete(key);
      throw err;
    }
  }

  return { mobileNumber: normalized, message: 'OTP sent successfully' };
}

function verifyOtp(mobileNumber, otp, purpose = 'login') {
  const normalized = normalizeMobile(mobileNumber);
  if (!otp || String(otp).trim() === '') {
    throw new AppError('OTP is required', 400);
  }

  const masterMatch =
    env.otp.masterEnabled && String(otp) === String(env.otp.devOtp);

  const key = storeKey(normalized, purpose);
  const record = otpStore.get(key);
  if (!masterMatch) {
    if (!record) {
      throw new AppError('OTP expired or not requested. Request a new OTP.', 400);
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(key);
      throw new AppError('OTP expired. Request a new OTP.', 400);
    }
    if (String(record.otp) !== String(otp)) {
      throw new AppError('Invalid OTP', 400);
    }
  }

  otpStore.delete(key);
  return normalized;
}

module.exports = {
  requestOtp,
  verifyOtp,
  isDemoNumber,
};
