'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    static associate(models) {
      Conversation.belongsTo(models.User, {
        foreignKey: 'participantOneId',
        as: 'participantOne',
      });
      Conversation.belongsTo(models.User, {
        foreignKey: 'participantTwoId',
        as: 'participantTwo',
      });
      Conversation.hasMany(models.Message, {
        foreignKey: 'conversationId',
        as: 'messages',
      });
      Conversation.belongsTo(models.ChatTheme, { foreignKey: 'chatThemeId', as: 'chatTheme' });
      Conversation.belongsTo(models.User, { foreignKey: 'chatThemeSetById', as: 'chatThemeSetBy' });
    }
  }

  Conversation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      participantOneId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      participantTwoId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      lastMessageAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      participantOneUnreadCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      participantTwoUnreadCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      participantOneLastReadAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      participantTwoLastReadAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      chatThemeId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      chatThemeSetById: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      chatThemeSetAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      participantOneFavoritedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      participantTwoFavoritedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      participantOneMutedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      participantTwoMutedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      participantOneArchivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      participantTwoArchivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Conversation',
      tableName: 'conversations',
    }
  );

  return Conversation;
};
