'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_plans', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      priceRupees: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      durationDays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      tagline: {
        type: Sequelize.STRING(160),
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

    await queryInterface.addIndex('subscription_plans', ['isActive', 'sortOrder']);

    await queryInterface.createTable('subscriptions', {
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
      planId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'subscription_plans', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      planName: {
        type: Sequelize.STRING(120),
        allowNull: false,
        defaultValue: 'Subscription',
      },
      priceRupees: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      durationDays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active',
      },
      paymentMethod: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      walletTransactionId: {
        type: Sequelize.UUID,
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

    await queryInterface.addIndex('subscriptions', ['userId']);
    await queryInterface.addIndex('subscriptions', ['userId', 'status']);
    await queryInterface.addIndex('subscriptions', ['expiresAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('subscriptions');
    await queryInterface.dropTable('subscription_plans');
  },
};
