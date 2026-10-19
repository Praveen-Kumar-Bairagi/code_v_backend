'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('withdrawal_requests', {
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
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      upiId: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      note: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      adminNote: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      reviewedByAdminId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'admins', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      walletTransactionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'wallet_transactions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('withdrawal_requests', ['userId']);
    await queryInterface.addIndex('withdrawal_requests', ['status']);
    await queryInterface.addIndex('withdrawal_requests', ['userId', 'status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('withdrawal_requests');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_withdrawal_requests_status";'
    );
  },
};
