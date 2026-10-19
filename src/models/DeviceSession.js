'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DeviceSession extends Model {
    static associate(models) {
      DeviceSession.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }

    toPublicJSON(currentSessionId) {
      const plain = this.get({ plain: true });
      return {
        id: plain.id,
        deviceName: plain.deviceName || 'Unknown device',
        platform: plain.platform || null,
        appVersion: plain.appVersion || null,
        lastActiveAt: plain.lastActiveAt,
        createdAt: plain.createdAt,
        current: currentSessionId ? plain.id === currentSessionId : false,
      };
    }
  }

  DeviceSession.init(
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
      deviceName: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      platform: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      appVersion: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      // IP at sign-in and the latest one seen; kept for lawful requests. Not shown to users.
      ipAddress: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      lastIpAddress: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      lastActiveAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'DeviceSession',
      tableName: 'device_sessions',
      timestamps: true,
    }
  );

  return DeviceSession;
};
