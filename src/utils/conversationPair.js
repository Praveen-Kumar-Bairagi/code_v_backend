'use strict';

function sortParticipantIds(userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  if (a === b) {
    return null;
  }
  return a < b ? [userIdA, userIdB] : [userIdB, userIdA];
}

module.exports = {
  sortParticipantIds,
};
