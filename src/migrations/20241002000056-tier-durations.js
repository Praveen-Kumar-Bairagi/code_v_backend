'use strict';

/** Chat = 30 days, Connect = 3 months, Plus = 6 months (the three plans on sale). */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE subscription_plans SET "durationDays" = 90, "isActive" = true, "updatedAt" = NOW()
       WHERE tier = 'connect' AND name = 'Connect' AND "durationDays" = 30`
    );
    await queryInterface.sequelize.query(
      `UPDATE subscription_plans SET "durationDays" = 180, "isActive" = true, "updatedAt" = NOW()
       WHERE tier = 'plus' AND name = 'Plus' AND "durationDays" = 30`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE subscription_plans SET "durationDays" = 30, "updatedAt" = NOW()
       WHERE tier = 'connect' AND name = 'Connect' AND "durationDays" = 90`
    );
    await queryInterface.sequelize.query(
      `UPDATE subscription_plans SET "durationDays" = 30, "updatedAt" = NOW()
       WHERE tier = 'plus' AND name = 'Plus' AND "durationDays" = 180`
    );
  },
};
