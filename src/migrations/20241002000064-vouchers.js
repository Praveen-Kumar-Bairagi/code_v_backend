'use strict';

/**
 * Admin vouchers for coin packs or subscriptions — either a discount at checkout
 * or a free reward (coins / a subscription plan) — limited to an audience.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vouchers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      code: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      title: { type: Sequelize.STRING(120), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      appliesTo: { type: Sequelize.STRING(20), allowNull: false },
      kind: { type: Sequelize.STRING(20), allowNull: false },
      discountType: { type: Sequelize.STRING(10), allowNull: true },
      discountValue: { type: Sequelize.INTEGER, allowNull: true },
      maxDiscountRupees: { type: Sequelize.INTEGER, allowNull: true },
      // Coin pack or subscription plan id. Discount: optional restriction. Subscription reward: the plan granted.
      targetId: { type: Sequelize.UUID, allowNull: true },
      rewardCoins: { type: Sequelize.INTEGER, allowNull: true },
      audience: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      startsAt: { type: Sequelize.DATE, allowNull: true },
      expiresAt: { type: Sequelize.DATE, allowNull: true },
      maxRedemptions: { type: Sequelize.INTEGER, allowNull: true },
      perUserLimit: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      redeemedCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      adminId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'admins', key: 'id' },
        onDelete: 'SET NULL',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('vouchers', ['isActive', 'appliesTo']);

    await queryInterface.createTable('voucher_redemptions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      voucherId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'vouchers', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Set for discounts (one redemption per paid order); null for free rewards.
      paymentOrderId: { type: Sequelize.UUID, allowNull: true, unique: true },
      itemName: { type: Sequelize.STRING(120), allowNull: true },
      originalRupees: { type: Sequelize.INTEGER, allowNull: true },
      discountRupees: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      rewardCoins: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      subscriptionId: { type: Sequelize.UUID, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('voucher_redemptions', ['voucherId', 'userId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('voucher_redemptions');
    await queryInterface.dropTable('vouchers');
  },
};
