'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('expo_push_tokens', {
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
      deviceSessionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'device_sessions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      token: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      platform: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      disabledAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastRegisteredAt: {
        type: Sequelize.DATE,
        allowNull: false,
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

    await queryInterface.addIndex('expo_push_tokens', ['userId']);
    await queryInterface.addIndex('expo_push_tokens', ['userId', 'disabledAt']);

    await queryInterface.addColumn('notifications', 'pushSentAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('notifications', 'pushTicketId', {
      type: Sequelize.STRING(120),
      allowNull: true,
    });
    await queryInterface.addColumn('notifications', 'pushError', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('notifications', 'pushError');
    await queryInterface.removeColumn('notifications', 'pushTicketId');
    await queryInterface.removeColumn('notifications', 'pushSentAt');
    await queryInterface.dropTable('expo_push_tokens');
  },
};
