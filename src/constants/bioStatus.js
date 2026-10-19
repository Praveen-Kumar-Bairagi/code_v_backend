const BIO_STATUS = {
  NONE: 'none',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const BIO_STATUS_VALUES = Object.values(BIO_STATUS);

const BIO_MAX_LENGTH = 500;

/** Block Snapchat / Instagram / Telegram handles & links in bio */
const SOCIAL_BIO_PATTERN =
  /\b(instagram|insta\.com|ig\.me|snapchat|snap\.chat|t\.me\/|telegram|wa\.me|whatsapp)\b|@[a-z0-9._]{3,}/i;

function assertBioAllowed(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  if (trimmed.length > BIO_MAX_LENGTH) {
    const err = new Error(`Bio must be at most ${BIO_MAX_LENGTH} characters`);
    err.statusCode = 400;
    throw err;
  }
  if (SOCIAL_BIO_PATTERN.test(trimmed)) {
    const err = new Error(
      'Do not write Snapchat, Instagram, Telegram, or other social profile links/handles in your bio'
    );
    err.statusCode = 400;
    throw err;
  }
  return trimmed;
}

module.exports = {
  BIO_STATUS,
  BIO_STATUS_VALUES,
  BIO_MAX_LENGTH,
  SOCIAL_BIO_PATTERN,
  assertBioAllowed,
};
