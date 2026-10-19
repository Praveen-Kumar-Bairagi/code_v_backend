'use strict';

/** Custom notifications sent by admins to all / filtered / hand-picked users. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_broadcasts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      adminId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'admins', key: 'id' },
        onDelete: 'SET NULL',
      },
      title: { type: Sequelize.STRING(200), allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: false },
      // { mode: 'all' | 'filter' | 'selected', gender, cityIds, userIds }
      audience: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      recipientCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      deviceCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      pushSentCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      pushFailedCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'sending' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('admin_broadcasts', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_broadcasts');
  },
};
