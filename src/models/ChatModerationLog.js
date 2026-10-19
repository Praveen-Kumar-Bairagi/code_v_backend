'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatModerationLog extends Model {
    static associate(models) {
      ChatModerationLog.belongsTo(models.User, { foreignKey: 'senderId', as: 'sender' });
      ChatModerationLog.belongsTo(models.Message, { foreignKey: 'messageId', as: 'message' });
    }
  }

  ChatModerationLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      messageId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      conversationId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      categories: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      matchCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      action: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'masked',
      },
      source: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'send',
      },
      severity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      /** none | pending | dismissed | warned | suspended */
      reviewStatus: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'none',
      },
      reviewedBy: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      adminNote: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ChatModerationLog',
      tableName: 'chat_moderation_logs',
      timestamps: true,
    }
  );

  return ChatModerationLog;
};
