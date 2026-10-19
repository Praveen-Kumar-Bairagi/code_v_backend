'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'users';
    await queryInterface.addColumn(table, 'onboardingStep', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 2,
    });
    await queryInterface.addColumn(table, 'onboardingCompleted', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Existing accounts are already past signup wizard
    await queryInterface.sequelize.query(
      `UPDATE users SET "onboardingCompleted" = true, "onboardingStep" = 0 WHERE "createdAt" IS NOT NULL`
    );
  },

  async down(queryInterface) {
    const table = 'users';
    await queryInterface.removeColumn(table, 'onboardingStep');
    await queryInterface.removeColumn(table, 'onboardingCompleted');
  },
};
