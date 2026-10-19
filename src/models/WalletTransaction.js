'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WalletTransaction extends Model {
    static associate(models) {
      WalletTransaction.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
      WalletTransaction.belongsTo(models.Booking, {
        foreignKey: 'bookingId',
        as: 'booking',
      });
    }
  }

  WalletTransaction.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      direction: {
        type: DataTypes.ENUM('credit', 'debit'),
        allowNull: false,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      balanceAfter: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      body: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      bookingId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      idempotencyKey: {
        type: DataTypes.STRING(120),
        allowNull: true,
        unique: true,
      },
      meta: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'WalletTransaction',
      tableName: 'wallet_transactions',
      timestamps: true,
    }
  );

  return WalletTransaction;
};
