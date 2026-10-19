const AppError = require('./AppError');

/**
 * Strip non-digits; remove leading 91 for 12-digit Indian numbers; require 10 digits.
 */
function normalizeMobile(mobileNumber) {
  if (mobileNumber === undefined || mobileNumber === null) {
    throw new AppError('Mobile number is required', 400);
  }
  let digits = String(mobileNumber).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10) {
    throw new AppError('Mobile number must be a 10-digit Indian number', 400);
  }
  return digits;
}

module.exports = normalizeMobile;
