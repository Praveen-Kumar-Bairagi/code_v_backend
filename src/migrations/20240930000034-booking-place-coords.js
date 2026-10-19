'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'placeId', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'locationLat', {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'locationLng', {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'locationLng');
    await queryInterface.removeColumn('bookings', 'locationLat');
    await queryInterface.removeColumn('bookings', 'placeId');
  },
};
