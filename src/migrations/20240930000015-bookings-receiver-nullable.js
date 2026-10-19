'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Sequelize changeColumn does not reliably drop NOT NULL on Postgres FKs
    await queryInterface.sequelize.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "receiverId" DROP NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "receiverId" SET NOT NULL;
    `);
  },
};
