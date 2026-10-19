'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'latitude', {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'longitude', {
      type: Sequelize.DOUBLE,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'locationUpdatedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'locationUpdatedAt');
    await queryInterface.removeColumn('users', 'longitude');
    await queryInterface.removeColumn('users', 'latitude');
  },
};
