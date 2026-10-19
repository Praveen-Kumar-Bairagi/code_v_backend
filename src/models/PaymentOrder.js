'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PaymentOrder extends Model {
    static associate(models) {
      PaymentOrder.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  PaymentOrder.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      /** 'subscription' (referenceId = planId) | 'booking' (referenceId = bookingId) */
      purpose: { type: DataTypes.STRING(30), allowNull: false },
      referenceId: { type: DataTypes.UUID, allowNull: false },
      /** Rupees */
      amount: { type: DataTypes.INTEGER, allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      /** created | paid | failed */
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'created' },
      razorpayOrderId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      razorpayPaymentId: { type: DataTypes.STRING(64), allowNull: true },
      razorpaySignature: { type: DataTypes.STRING(256), allowNull: true },
      returnUrl: { type: DataTypes.STRING(500), allowNull: true },
      failureReason: { type: DataTypes.STRING(500), allowNull: true },
      meta: { type: DataTypes.JSONB, allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'PaymentOrder',
      tableName: 'payment_orders',
      timestamps: true,
    }
  );

  return PaymentOrder;
};
