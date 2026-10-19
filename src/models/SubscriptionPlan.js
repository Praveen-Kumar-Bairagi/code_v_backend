'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SubscriptionPlan extends Model {
    static associate(models) {
      SubscriptionPlan.hasMany(models.Subscription, {
        foreignKey: 'planId',
        as: 'purchases',
      });
    }

    toPublicJSON() {
      const plain = this.get({ plain: true });
      return {
        id: plain.id,
        name: plain.name,
        priceRupees: plain.priceRupees,
        durationDays: plain.durationDays,
        isActive: plain.isActive,
        sortOrder: plain.sortOrder,
        tagline: plain.tagline || null,
        bonusCoins: plain.bonusCoins ?? 0,
        tier: plain.tier || 'chat',
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
      };
    }
  }

  SubscriptionPlan.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
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
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      tagline: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      bonusCoins: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      tier: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'chat',
      },
    },
    {
      sequelize,
      modelName: 'SubscriptionPlan',
      tableName: 'subscription_plans',
      timestamps: true,
    }
  );

  return SubscriptionPlan;
};
