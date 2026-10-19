'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'lastActiveAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE users AS u
      SET "lastActiveAt" = s.max_active
      FROM (
        SELECT "userId", MAX("lastActiveAt") AS max_active
        FROM device_sessions
        GROUP BY "userId"
      ) AS s
      WHERE u.id = s."userId"
    `);

    await queryInterface.addIndex('users', ['lastActiveAt']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', ['lastActiveAt']);
    await queryInterface.removeColumn('users', 'lastActiveAt');
  },
};
