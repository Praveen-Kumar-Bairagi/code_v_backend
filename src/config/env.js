require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 6002,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  otp: {
    devOtp: process.env.DEV_OTP || process.env.MASTER_OTP || '1234',
    masterEnabled: process.env.OTP_MASTER_ENABLED === 'true',
    /** Play reviewers / foreign testers: these numbers log in with demoOtp and never get an SMS. */
    demoNumbers: String(process.env.DEMO_LOGIN_NUMBERS || '')
      .split(',')
      .map((n) => n.replace(/\D/g, '').slice(-10))
      .filter((n) => n.length === 10),
    demoOtp: String(process.env.DEMO_LOGIN_OTP || '').trim(),
  },
  /** DLT SMS gateway — OTPs are only sent when SMS_ENABLED=true and the keys are set. */
  sms: {
    enabled: process.env.SMS_ENABLED === 'true',
    apiUrl: process.env.SMS_API_URL || 'https://apitxt.com/api/sendMsg',
    otpApiUrl: process.env.SMS_OTP_API_URL || 'https://apitxt.com/api/sendOtp',
    balanceUrl: process.env.SMS_BALANCE_URL || 'https://apitxt.com/api/balance',
    /** Admin dashboard warns when credits drop below this. */
    lowBalance: Number(process.env.SMS_LOW_BALANCE) || 100,
    authKey: process.env.SMS_AUTH_KEY || '',
    senderId: process.env.SMS_SENDER_ID || '',
    route: process.env.SMS_ROUTE || '4',
    peId: process.env.SMS_PE_ID || '',
    otpTemplateId: process.env.SMS_OTP_TEMPLATE_ID || '',
    otpTemplate:
      process.env.SMS_OTP_TEMPLATE ||
      '{otp} is your CompaMeet verification code. It is valid for {minutes} minutes. Do not share it with anyone.',
    otpValidityMinutes: Number(process.env.SMS_OTP_VALIDITY_MINUTES) || 5,
  },
  /** Google sign-in: the app sends a Firebase ID token, verified against this project. */
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  },
  features: {
    /** Bookings are Phase 2 — off unless FEATURE_BOOKINGS=true */
    bookings: process.env.FEATURE_BOOKINGS === 'true',
  },
  expo: {
    /** Optional — raises Expo Push API rate limits; never commit a real token */
    accessToken: process.env.EXPO_ACCESS_TOKEN || null,
  },
  /** Public base URL of this API (used for Razorpay checkout + callback URLs) */
  publicApiUrl: (
    process.env.PUBLIC_API_URL ||
    process.env.BASE_URL ||
    `http://localhost:${Number(process.env.PORT) || 6002}`
  ).replace(/\/$/, ''),
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    /** RazorpayX current account number — enables automatic UPI payouts on withdrawal approval */
    payoutAccountNumber: process.env.RAZORPAYX_ACCOUNT_NUMBER || '',
    payoutMode: process.env.RAZORPAYX_PAYOUT_MODE || 'UPI',
    brandName: process.env.RAZORPAY_BRAND_NAME || 'CompaMeet',
  },
  /**
   * Simulated payments (no money moves). Defaults to ON when Razorpay keys are missing;
   * set PAYMENT_TEST_MODE=false on production to hard-disable it.
   */
  paymentTestMode:
    process.env.PAYMENT_TEST_MODE != null && process.env.PAYMENT_TEST_MODE !== ''
      ? process.env.PAYMENT_TEST_MODE === 'true'
      : !(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  /** Allowed post-payment redirect prefixes (app deep links + web app) */
  paymentReturnUrlPrefixes: (
    process.env.PAYMENT_RETURN_URL_PREFIXES ||
    'compameet://,exp://,http://localhost:,https://compameet.com'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
