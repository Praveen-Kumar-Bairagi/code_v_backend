'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CaptureScreenshot extends Model {
    static associate(models) {
      CaptureScreenshot.belongsTo(models.CaptureSession, {
        foreignKey: 'sessionId',
        as: 'session',
      });
      CaptureScreenshot.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  CaptureScreenshot.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      sessionId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      storageKey: { type: DataTypes.STRING(512), allowNull: false },
      mimeType: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'image/jpeg' },
      byteSize: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      width: { type: DataTypes.INTEGER, allowNull: true },
      height: { type: DataTypes.INTEGER, allowNull: true },
      deviceId: { type: DataTypes.STRING(128), allowNull: true },
      dayKey: { type: DataTypes.STRING(10), allowNull: false },
      capturedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, modelName: 'CaptureScreenshot', tableName: 'capture_screenshots', timestamps: true }
  );

  return CaptureScreenshot;
};
