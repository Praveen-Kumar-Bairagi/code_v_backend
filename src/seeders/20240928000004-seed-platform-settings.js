'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('platform_settings', [
      {
        key: 'chatSubscriptionAmount',
        value: '299',
        createdAt: now,
        updatedAt: now,
      },
      {
        key: 'bookingMinHours',
        value: '1',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('platform_settings', {
      key: { [Op.in]: ['chatSubscriptionAmount', 'bookingMinHours'] },
    });
  },
};
