'use strict';

/** Google (Firebase) sign-in: accounts may exist without a mobile number until the user verifies one. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'googleUid', {
      type: Sequelize.STRING(128),
      allowNull: true,
      unique: true,
    });
    await queryInterface.changeColumn('users', 'mobileNumber', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'googleUid');
    await queryInterface.changeColumn('users', 'mobileNumber', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
