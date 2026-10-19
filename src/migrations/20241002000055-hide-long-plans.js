'use strict';

/** Keep only the three monthly tiers (Chat, Connect, Plus) on sale; admin can re-enable others. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE subscription_plans SET "isActive" = false, "updatedAt" = NOW() WHERE "durationDays" > 31`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE subscription_plans SET "isActive" = true, "updatedAt" = NOW() WHERE "durationDays" > 31`
    );
  },
};
