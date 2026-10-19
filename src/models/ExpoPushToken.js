'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ExpoPushToken extends Model {
    static associate(models) {
      ExpoPushToken.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      ExpoPushToken.belongsTo(models.DeviceSession, {
        foreignKey: 'deviceSessionId',
        as: 'deviceSession',
      });
    }
  }

  ExpoPushToken.init(
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
      deviceSessionId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      token: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      platform: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      disabledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastRegisteredAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'ExpoPushToken',
      tableName: 'expo_push_tokens',
      timestamps: true,
    }
  );

  return ExpoPushToken;
};
