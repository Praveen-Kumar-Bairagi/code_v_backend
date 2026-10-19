const { Op } = require('sequelize');
const { User } = require('../models');
const { createAndEmitNotification } = require('../services/v1/user/notificationCreateService');

let timer = null;

async function expireCreatorProfiles() {
  const expired = await User.findAll({
    where: { isCreator: true, creatorExpiresAt: { [Op.lte]: new Date() } },
    attributes: ['id', 'creatorHandle'],
    limit: 500,
  });
  for (const user of expired) {
    const [updated] = await User.update(
      { isCreator: false },
      { where: { id: user.id, isCreator: true } }
    );
    if (!updated) continue;
    await createAndEmitNotification({
      recipientId: user.id,
      type: 'creator_expired',
      title: 'Creator profile expired',
      body: `Your creator profile @${user.creatorHandle} has expired. Send a new request to become a creator again.`,
      data: { creatorHandle: user.creatorHandle },
    }).catch(() => {});
  }
  return expired.length;
}

function startCreatorExpiryJob({ intervalMs = 5 * 60_000 } = {}) {
  if (timer) return;
  const tick = async () => {
    try {
      await expireCreatorProfiles();
    } catch (err) {
      console.error('[creator-expiry]', err.message || err);
    }
  };
  tick();
  timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = { expireCreatorProfiles, startCreatorExpiryJob };
