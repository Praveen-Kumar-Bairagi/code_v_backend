const RELIGIONS = [
  'Hindu',
  'Muslim',
  'Christian',
  'Sikh',
  'Buddhist',
  'Jain',
  'Parsi',
  'Jewish',
  'Spiritual',
  'No religion',
  'Other',
];

/** Case-insensitive match to a canonical religion label, or null. */
function normalizeReligion(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  return RELIGIONS.find((r) => r.toLowerCase() === s) || null;
}

module.exports = { RELIGIONS, normalizeReligion };
