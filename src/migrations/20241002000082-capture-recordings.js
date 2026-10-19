'use strict';

/** Admin-saved live capture recordings (WebM). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('capture_recordings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sessionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'capture_sessions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      adminId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      storageKey: { type: Sequelize.STRING(512), allowNull: false },
      mimeType: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'video/webm' },
      byteSize: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      width: { type: Sequelize.INTEGER, allowNull: true },
      height: { type: Sequelize.INTEGER, allowNull: true },
      durationSec: { type: Sequelize.FLOAT, allowNull: true },
      frameCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      startedAt: { type: Sequelize.DATE, allowNull: true },
      endedAt: { type: Sequelize.DATE, allowNull: true },
      dayKey: { type: Sequelize.STRING(10), allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('capture_recordings', ['userId', 'createdAt'], {
      name: 'capture_recordings_user_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('capture_recordings');
  },
};
