'use strict';

/** Audit trail for masked chat messages. Never stores the original text. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_moderation_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      messageId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'messages', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      conversationId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      categories: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      matchCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      action: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'masked',
      },
      source: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'send',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('chat_moderation_logs', ['senderId']);
    await queryInterface.addIndex('chat_moderation_logs', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('chat_moderation_logs');
  },
};
