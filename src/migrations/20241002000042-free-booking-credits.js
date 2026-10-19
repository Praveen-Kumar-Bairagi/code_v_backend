'use strict';

/** Every user (existing + new) starts with 1 free booking create and 1 free accept. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'freeBookingCreatesLeft', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn('users', 'freeBookingAcceptsLeft', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'freeBookingAcceptsLeft');
    await queryInterface.removeColumn('users', 'freeBookingCreatesLeft');
  },
};
