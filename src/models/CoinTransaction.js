'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CoinTransaction extends Model {
    static associate(models) {
      CoinTransaction.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  CoinTransaction.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      /** signup_bonus | plan_post | subscription_bonus | purchase | admin_adjust */
      type: { type: DataTypes.STRING(30), allowNull: false },
      /** Signed: positive = credit, negative = debit. */
      amount: { type: DataTypes.INTEGER, allowNull: false },
      balanceAfter: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(160), allowNull: false },
      referenceId: { type: DataTypes.STRING(64), allowNull: true },
      idempotencyKey: { type: DataTypes.STRING(120), allowNull: true, unique: true },
      meta: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      sequelize,
      modelName: 'CoinTransaction',
      tableName: 'coin_transactions',
      timestamps: true,
    }
  );

  return CoinTransaction;
};
