'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class E2eeDeviceKey extends Model {
    static associate(models) {
      E2eeDeviceKey.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  E2eeDeviceKey.init(
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
      // Random id generated on the device; the private key never leaves it.
      deviceId: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      // X25519 public key, base64.
      publicKey: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'E2eeDeviceKey',
      tableName: 'e2ee_device_keys',
      timestamps: true,
    }
  );

  return E2eeDeviceKey;
};
