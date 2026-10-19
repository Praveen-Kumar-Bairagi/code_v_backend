'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const subjects = [
      { name: 'Account / Login issue', sortOrder: 1, isOther: false },
      { name: 'Profile / Photos', sortOrder: 2, isOther: false },
      { name: 'Booking issue', sortOrder: 3, isOther: false },
      { name: 'Payment / Subscription', sortOrder: 4, isOther: false },
      { name: 'Chat / Matches', sortOrder: 5, isOther: false },
      { name: 'Withdrawal / Earnings', sortOrder: 6, isOther: false },
      { name: 'Report a bug', sortOrder: 7, isOther: false },
      { name: 'Safety concern', sortOrder: 8, isOther: false },
      { name: 'Other', sortOrder: 9999, isOther: true },
    ];

    const [existing] = await queryInterface.sequelize.query(
      `SELECT name FROM support_subjects`
    );
    const have = new Set((existing || []).map((r) => String(r.name).toLowerCase()));
    const rows = subjects
      .filter((item) => !have.has(item.name.toLowerCase()))
      .map((item) => ({
        id: uuidv4(),
        name: item.name,
        isActive: true,
        isOther: item.isOther,
        sortOrder: item.sortOrder,
        createdAt: now,
        updatedAt: now,
      }));
    if (rows.length) {
      await queryInterface.bulkInsert('support_subjects', rows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('support_subjects', null, {});
  },
};
