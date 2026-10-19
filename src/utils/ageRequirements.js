const calcAge = require('./calcAge');
const AppError = require('./AppError');

const MIN_AGE = {
  male: 21,
  female: 18,
  other: 18,
};

const GENDERS = ['male', 'female', 'other'];

function getMinAgeForGender(gender) {
  const key = String(gender).toLowerCase();
  if (!GENDERS.includes(key)) {
    throw new AppError('Invalid gender. Allowed: male, female, other', 400);
  }
  return MIN_AGE[key];
}

function assertMeetsAgeRequirement(gender, dateOfBirth) {
  const minAge = getMinAgeForGender(gender);
  const age = calcAge(dateOfBirth);
  if (age === null) {
    throw new AppError('Invalid date of birth', 400);
  }
  if (age < minAge) {
    throw new AppError(
      `Minimum age for ${gender} is ${minAge} years. You are ${age}.`,
      400
    );
  }
}

module.exports = {
  MIN_AGE,
  GENDERS,
  getMinAgeForGender,
  assertMeetsAgeRequirement,
};
