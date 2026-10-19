'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_orders', {
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
        onDelete: 'CASCADE',
      },
      purpose: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      referenceId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'INR',
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'created',
      },
      razorpayOrderId: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      razorpayPaymentId: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      razorpaySignature: {
        type: Sequelize.STRING(256),
        allowNull: true,
      },
      returnUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      failureReason: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      meta: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('payment_orders', ['userId']);
    await queryInterface.addIndex('payment_orders', ['purpose', 'referenceId']);

    await queryInterface.addColumn('withdrawal_requests', 'payoutId', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addColumn('withdrawal_requests', 'payoutStatus', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });
    await queryInterface.addColumn('withdrawal_requests', 'payoutUtr', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addColumn('withdrawal_requests', 'payoutFailureReason', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('withdrawal_requests', 'payoutFailureReason');
    await queryInterface.removeColumn('withdrawal_requests', 'payoutUtr');
    await queryInterface.removeColumn('withdrawal_requests', 'payoutStatus');
    await queryInterface.removeColumn('withdrawal_requests', 'payoutId');
    await queryInterface.dropTable('payment_orders');
  },
};
