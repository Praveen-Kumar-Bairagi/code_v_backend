'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages', 'replyToId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'messages', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('messages', 'replyToId');
  },
};
