const { Op } = require('sequelize');
const { User } = require('../models');
const legalRetentionService = require('../services/legalRetentionService');
const { createAndEmitNotification } = require('../services/v1/user/notificationCreateService');

const REMINDER_EVERY_MS = 90 * 24 * 60 * 60 * 1000;
const REMINDER_BATCH = 200;

let timer = null;

/**
 * IT Rules 2021, Rule 3(1)(c): remind members of our rules, privacy policy and user agreement,
 * and of the consequences of breaking them, at least once every three months.
 * New accounts get their first reminder three months after signing up (they accepted the Terms then).
 */
async function sendPolicyReminders() {
  const cutoff = new Date(Date.now() - REMINDER_EVERY_MS);
  const due = await User.findAll({
    where: {
      isActive: true,
      createdAt: { [Op.lte]: cutoff },
      [Op.or]: [{ policyReminderAt: null }, { policyReminderAt: { [Op.lte]: cutoff } }],
    },
    attributes: ['id'],
    limit: REMINDER_BATCH,
  });
  for (const user of due) {
    const [updated] = await User.update(
      { policyReminderAt: new Date() },
      {
        where: {
          id: user.id,
          [Op.or]: [{ policyReminderAt: null }, { policyReminderAt: { [Op.lte]: cutoff } }],
        },
      }
    );
    if (!updated) continue;
    await createAndEmitNotification({
      recipientId: user.id,
      type: 'policy_reminder',
      title: 'A reminder of Compameet’s rules',
      body:
        'Please keep following our Terms of Service, Community Guidelines and Privacy Policy. ' +
        'Breaking them — for example fake profiles, harassment, sharing intimate images, scams or illegal content — ' +
        'can lead to removal of content, suspension or a permanent ban, and may be reported to the authorities where the law requires. ' +
        'Tap to read them in Profile → Legal.',
      data: { legal: true },
    }).catch((err) => console.warn('[policy-reminder] notify failed', err?.message || err));
  }
  return due.length;
}

function startLegalComplianceJob({ intervalMs = 60 * 60_000 } = {}) {
  if (timer) return;
  const tick = async () => {
    try {
      await legalRetentionService.purgeExpired();
    } catch (err) {
      console.error('[legal-retention]', err.message || err);
    }
    try {
      await sendPolicyReminders();
    } catch (err) {
      console.error('[policy-reminder]', err.message || err);
    }
  };
  tick();
  timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = { sendPolicyReminders, startLegalComplianceJob };
