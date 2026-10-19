'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('conversations', 'participantOneLastReadAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('conversations', 'participantTwoLastReadAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.sequelize.query(`
      UPDATE conversations
      SET "participantOneLastReadAt" = CASE WHEN "participantOneUnreadCount" = 0 THEN "lastMessageAt" END,
          "participantTwoLastReadAt" = CASE WHEN "participantTwoUnreadCount" = 0 THEN "lastMessageAt" END
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('conversations', 'participantOneLastReadAt');
    await queryInterface.removeColumn('conversations', 'participantTwoLastReadAt');
  },
};
