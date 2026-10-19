'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.religion) {
      await queryInterface.addColumn('users', 'religion', {
        type: Sequelize.STRING(40),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.religion) {
      await queryInterface.removeColumn('users', 'religion');
    }
  },
};
