'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'accountStatus', {
      type: Sequelize.ENUM('active', 'inactive', 'blocked', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    });
    await queryInterface.sequelize.query(
      `UPDATE users SET "accountStatus" = 'inactive' WHERE "isActive" = false`
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'accountStatus');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_users_accountStatus";'
    );
  },
};
