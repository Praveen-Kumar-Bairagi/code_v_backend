'use strict';

/** Reports users file against other users, from Discover/profile ("profile") or a chat ("chat"). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_reports', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      reporterId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      reportedUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      source: { type: Sequelize.STRING(20), allowNull: false },
      conversationId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'conversations', key: 'id' },
        onDelete: 'SET NULL',
      },
      reason: { type: Sequelize.STRING(40), allowNull: false },
      details: { type: Sequelize.TEXT, allowNull: true },
      // Snapshot taken when filed (profile + chat), so evidence survives edits, blocks and deleted chats.
      evidence: { type: Sequelize.JSONB, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' },
      adminNote: { type: Sequelize.TEXT, allowNull: true },
      reviewedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('user_reports', ['source', 'status', 'createdAt']);
    await queryInterface.addIndex('user_reports', ['reportedUserId']);
    await queryInterface.addIndex('user_reports', ['reporterId', 'reportedUserId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_reports');
  },
};
