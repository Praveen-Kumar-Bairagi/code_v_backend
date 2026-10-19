'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('device_sessions', {
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
      deviceName: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      platform: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      appVersion: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      lastActiveAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      revokedAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('device_sessions', ['userId']);
    await queryInterface.addIndex('device_sessions', ['userId', 'revokedAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('device_sessions');
  },
};
