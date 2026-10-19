'use strict';

const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const APP_NAME = 'compameet-auth';

function firebaseAuth() {
  if (!env.firebase.projectId) {
    throw new AppError('Google sign-in is not configured on the server', 503);
  }
  // ID token verification only needs the project id (public signing keys), no service account.
  const app =
    getApps().find((a) => a.name === APP_NAME) ||
    initializeApp({ projectId: env.firebase.projectId }, APP_NAME);
  return getAuth(app);
}

/**
 * Verifies a Firebase ID token from a Google sign-in and returns the Google identity.
 * @returns {Promise<{ uid: string, email: string, firstName: string, lastName: string, photoUrl: string | null }>}
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new AppError('idToken is required', 400);
  }
  let decoded;
  try {
    decoded = await firebaseAuth().verifyIdToken(idToken);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Google sign-in expired or invalid. Please try again.', 401);
  }
  if (decoded.firebase?.sign_in_provider !== 'google.com') {
    throw new AppError('Only Google sign-in is supported here', 400);
  }
  if (!decoded.email || decoded.email_verified !== true) {
    throw new AppError('Your Google account email is not verified', 400);
  }
  const fullName = String(decoded.name || '').trim();
  const [firstName = '', ...rest] = fullName.split(/\s+/).filter(Boolean);
  return {
    uid: decoded.uid,
    email: String(decoded.email).trim().toLowerCase(),
    firstName,
    lastName: rest.join(' '),
    photoUrl: decoded.picture || null,
  };
}

module.exports = { verifyGoogleIdToken };
