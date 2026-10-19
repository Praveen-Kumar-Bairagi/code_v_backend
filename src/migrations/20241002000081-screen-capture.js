'use strict';

/** Authorized MediaProjection capture sessions + private screenshot metadata. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('capture_sessions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      adminId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'admins', key: 'id' },
        onDelete: 'SET NULL',
      },
      deviceId: { type: Sequelize.STRING(128), allowNull: true },
      status: {
        type: Sequelize.STRING(24),
        allowNull: false,
        defaultValue: 'pending',
      },
      startedAt: { type: Sequelize.DATE, allowNull: true },
      endedAt: { type: Sequelize.DATE, allowNull: true },
      endReason: { type: Sequelize.STRING(64), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('capture_sessions', ['userId', 'status'], {
      name: 'capture_sessions_user_status',
    });

    await queryInterface.createTable('capture_screenshots', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      sessionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'capture_sessions', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      storageKey: { type: Sequelize.STRING(512), allowNull: false },
      mimeType: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'image/jpeg' },
      byteSize: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      width: { type: Sequelize.INTEGER, allowNull: true },
      height: { type: Sequelize.INTEGER, allowNull: true },
      deviceId: { type: Sequelize.STRING(128), allowNull: true },
      dayKey: { type: Sequelize.STRING(10), allowNull: false },
      capturedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('capture_screenshots', ['sessionId', 'capturedAt'], {
      name: 'capture_screenshots_session_captured',
    });
    await queryInterface.addIndex('capture_screenshots', ['userId', 'dayKey'], {
      name: 'capture_screenshots_user_day',
    });

    await queryInterface.createTable('security_audit_events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      actorType: { type: Sequelize.STRING(16), allowNull: false },
      actorId: { type: Sequelize.UUID, allowNull: true },
      action: { type: Sequelize.STRING(64), allowNull: false },
      targetUserId: { type: Sequelize.UUID, allowNull: true },
      meta: { type: Sequelize.JSONB, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('security_audit_events', ['action', 'createdAt'], {
      name: 'security_audit_events_action_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('security_audit_events');
    await queryInterface.dropTable('capture_screenshots');
    await queryInterface.dropTable('capture_sessions');
  },
};
