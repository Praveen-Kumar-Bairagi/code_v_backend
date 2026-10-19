'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Subscription extends Model {
    static associate(models) {
      Subscription.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Subscription.belongsTo(models.SubscriptionPlan, {
        foreignKey: 'planId',
        as: 'plan',
      });
    }

    isCurrentlyActive() {
      return (
        this.status === 'active' &&
        this.expiresAt &&
        new Date(this.expiresAt).getTime() > Date.now()
      );
    }
  }

  Subscription.init(
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
      planId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      planName: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: 'Subscription',
      },
      priceRupees: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      durationDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active',
      },
      paymentMethod: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      walletTransactionId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Subscription',
      tableName: 'subscriptions',
      timestamps: true,
    }
  );

  return Subscription;
};
