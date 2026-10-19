'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VoucherRedemption extends Model {
    static associate(models) {
      VoucherRedemption.belongsTo(models.Voucher, { foreignKey: 'voucherId', as: 'voucher' });
      VoucherRedemption.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  VoucherRedemption.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      voucherId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      paymentOrderId: { type: DataTypes.UUID, allowNull: true, unique: true },
      itemName: { type: DataTypes.STRING(120), allowNull: true },
      originalRupees: { type: DataTypes.INTEGER, allowNull: true },
      discountRupees: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      rewardCoins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      subscriptionId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: 'VoucherRedemption',
      tableName: 'voucher_redemptions',
      timestamps: true,
    }
  );

  return VoucherRedemption;
};
