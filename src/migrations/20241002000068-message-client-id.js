'use strict';

/**
 * clientMessageId makes chat sends idempotent: a retried send returns the stored message
 * instead of inserting a duplicate. The composite index serves the newest-first message
 * pages (WHERE "conversationId" = ? ORDER BY "createdAt" DESC, id DESC LIMIT n).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages', 'clientMessageId', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addIndex('messages', ['senderId', 'clientMessageId'], {
      name: 'messages_sender_client_message_id_unique',
      unique: true,
      where: { clientMessageId: { [Sequelize.Op.ne]: null } },
    });
    await queryInterface.addIndex('messages', ['conversationId', 'createdAt', 'id'], {
      name: 'messages_conversation_created_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('messages', 'messages_conversation_created_id');
    await queryInterface.removeIndex('messages', 'messages_sender_client_message_id_unique');
    await queryInterface.removeColumn('messages', 'clientMessageId');
  },
};
