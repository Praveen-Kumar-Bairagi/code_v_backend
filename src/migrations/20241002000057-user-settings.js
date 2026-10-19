'use strict';

/** Privacy + push notification preferences (see services/v1/user/settingsService.js). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'settings', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'settings');
  },
};
