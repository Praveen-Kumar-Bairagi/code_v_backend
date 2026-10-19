'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserReport extends Model {
    static associate(models) {
      UserReport.belongsTo(models.User, { foreignKey: 'reporterId', as: 'reporter' });
      UserReport.belongsTo(models.User, { foreignKey: 'reportedUserId', as: 'reportedUser' });
      UserReport.belongsTo(models.Conversation, { foreignKey: 'conversationId', as: 'conversation' });
    }
  }

  UserReport.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reporterId: { type: DataTypes.UUID, allowNull: false },
      reportedUserId: { type: DataTypes.UUID, allowNull: false },
      source: { type: DataTypes.STRING(20), allowNull: false },
      conversationId: { type: DataTypes.UUID, allowNull: true },
      reason: { type: DataTypes.STRING(40), allowNull: false },
      details: { type: DataTypes.TEXT, allowNull: true },
      evidence: { type: DataTypes.JSONB, allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
      adminNote: { type: DataTypes.TEXT, allowNull: true },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, modelName: 'UserReport', tableName: 'user_reports', timestamps: true }
  );

  return UserReport;
};
