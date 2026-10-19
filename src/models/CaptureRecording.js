'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CaptureRecording extends Model {
    static associate(models) {
      CaptureRecording.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      CaptureRecording.belongsTo(models.CaptureSession, {
        foreignKey: 'sessionId',
        as: 'session',
      });
    }
  }

  CaptureRecording.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      sessionId: { type: DataTypes.UUID, allowNull: true },
      adminId: { type: DataTypes.UUID, allowNull: true },
      storageKey: { type: DataTypes.STRING(512), allowNull: false },
      mimeType: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'video/webm' },
      byteSize: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      width: { type: DataTypes.INTEGER, allowNull: true },
      height: { type: DataTypes.INTEGER, allowNull: true },
      durationSec: { type: DataTypes.FLOAT, allowNull: true },
      frameCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      endedAt: { type: DataTypes.DATE, allowNull: true },
      dayKey: { type: DataTypes.STRING(10), allowNull: false },
    },
    { sequelize, modelName: 'CaptureRecording', tableName: 'capture_recordings', timestamps: true }
  );

  return CaptureRecording;
};
