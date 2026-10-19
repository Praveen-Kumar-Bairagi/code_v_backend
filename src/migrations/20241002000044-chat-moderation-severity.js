'use strict';

/** Severity + admin review on moderation logs; per-user chat violation tracking. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('chat_moderation_logs', 'severity', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn('chat_moderation_logs', 'reviewStatus', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'none',
    });
    await queryInterface.addColumn('chat_moderation_logs', 'reviewedBy', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn('chat_moderation_logs', 'reviewedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('chat_moderation_logs', 'adminNote', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addIndex('chat_moderation_logs', ['severity']);
    await queryInterface.addIndex('chat_moderation_logs', ['reviewStatus']);

    await queryInterface.addColumn('users', 'chatViolationCount', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('users', 'chatWarningCount', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('users', 'chatSuspended', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('users', 'chatSuspendedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'chatSuspendedAt');
    await queryInterface.removeColumn('users', 'chatSuspended');
    await queryInterface.removeColumn('users', 'chatWarningCount');
    await queryInterface.removeColumn('users', 'chatViolationCount');
    await queryInterface.removeIndex('chat_moderation_logs', ['reviewStatus']);
    await queryInterface.removeIndex('chat_moderation_logs', ['severity']);
    await queryInterface.removeColumn('chat_moderation_logs', 'adminNote');
    await queryInterface.removeColumn('chat_moderation_logs', 'reviewedAt');
    await queryInterface.removeColumn('chat_moderation_logs', 'reviewedBy');
    await queryInterface.removeColumn('chat_moderation_logs', 'reviewStatus');
    await queryInterface.removeColumn('chat_moderation_logs', 'severity');
  },
};
