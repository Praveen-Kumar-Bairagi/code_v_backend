'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'users';
    await queryInterface.addColumn(table, 'pendingBio', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'bioStatus', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'none',
    });
  },

  async down(queryInterface) {
    const table = 'users';
    await queryInterface.removeColumn(table, 'pendingBio');
    await queryInterface.removeColumn(table, 'bioStatus');
  },
};
