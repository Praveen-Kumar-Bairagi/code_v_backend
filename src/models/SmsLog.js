'use strict';

const { Model } = require('sequelize');

/** One row per SMS gateway call. OTP codes are never stored. */
module.exports = (sequelize, DataTypes) => {
  class SmsLog extends Model {}

  SmsLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      mobile: { type: DataTypes.STRING(20), allowNull: false },
      kind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'otp' },
      purpose: { type: DataTypes.STRING(40), allowNull: true },
      templateId: { type: DataTypes.STRING(60), allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false },
      httpStatus: { type: DataTypes.INTEGER, allowNull: true },
      requestId: { type: DataTypes.STRING(120), allowNull: true },
      responseMessage: { type: DataTypes.STRING(500), allowNull: true },
      response: { type: DataTypes.JSONB, allowNull: true },
      durationMs: { type: DataTypes.INTEGER, allowNull: true },
    },
    { sequelize, modelName: 'SmsLog', tableName: 'sms_logs', timestamps: true }
  );

  return SmsLog;
};
