'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Voucher extends Model {
    static associate(models) {
      Voucher.hasMany(models.VoucherRedemption, { foreignKey: 'voucherId', as: 'redemptions' });
    }
  }

  Voucher.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      title: { type: DataTypes.STRING(120), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      appliesTo: { type: DataTypes.STRING(20), allowNull: false },
      kind: { type: DataTypes.STRING(20), allowNull: false },
      discountType: { type: DataTypes.STRING(10), allowNull: true },
      discountValue: { type: DataTypes.INTEGER, allowNull: true },
      maxDiscountRupees: { type: DataTypes.INTEGER, allowNull: true },
      targetId: { type: DataTypes.UUID, allowNull: true },
      rewardCoins: { type: DataTypes.INTEGER, allowNull: true },
      audience: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      startsAt: { type: DataTypes.DATE, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      maxRedemptions: { type: DataTypes.INTEGER, allowNull: true },
      perUserLimit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      redeemedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      adminId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, modelName: 'Voucher', tableName: 'vouchers', timestamps: true }
  );

  return Voucher;
};
