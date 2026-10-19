'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'walletBalance', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.createTable('wallet_transactions', {
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
      type: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      direction: {
        type: Sequelize.ENUM('credit', 'debit'),
        allowNull: false,
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      balanceAfter: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      body: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      bookingId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'bookings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      idempotencyKey: {
        type: Sequelize.STRING(120),
        allowNull: true,
        unique: true,
      },
      meta: {
        type: Sequelize.JSONB,
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

    await queryInterface.addIndex('wallet_transactions', ['userId']);
    await queryInterface.addIndex('wallet_transactions', ['userId', 'createdAt']);
    await queryInterface.addIndex('wallet_transactions', ['bookingId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wallet_transactions');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_wallet_transactions_direction";'
    );
    await queryInterface.removeColumn('users', 'walletBalance');
  },
};
