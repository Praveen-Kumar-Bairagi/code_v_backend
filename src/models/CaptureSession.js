'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CaptureSession extends Model {
    static associate(models) {
      CaptureSession.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      CaptureSession.belongsTo(models.Admin, { foreignKey: 'adminId', as: 'admin' });
      CaptureSession.hasMany(models.CaptureScreenshot, {
        foreignKey: 'sessionId',
        as: 'screenshots',
      });
    }
  }

  CaptureSession.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      adminId: { type: DataTypes.UUID, allowNull: true },
      deviceId: { type: DataTypes.STRING(128), allowNull: true },
      status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'pending' },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      endedAt: { type: DataTypes.DATE, allowNull: true },
      endReason: { type: DataTypes.STRING(64), allowNull: true },
    },
    { sequelize, modelName: 'CaptureSession', tableName: 'capture_sessions', timestamps: true }
  );

  return CaptureSession;
};
