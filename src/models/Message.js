'use strict';

const { Model } = require('sequelize');
const { maskChatText } = require('../utils/chatModerationConfig');
const { encryptText, decryptText } = require('../utils/messageCrypto');

module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      Message.belongsTo(models.Conversation, {
        foreignKey: 'conversationId',
        as: 'conversation',
      });
      Message.belongsTo(models.User, { foreignKey: 'senderId', as: 'sender' });
      Message.belongsTo(models.Message, { foreignKey: 'replyToId', as: 'replyTo' });
    }
  }

  Message.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      conversationId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      // Encrypted at rest (AES-256-GCM); getters return plaintext.
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
        get() {
          return decryptText(this.getDataValue('body'));
        },
        set(value) {
          this.setDataValue('body', encryptText(value));
        },
      },
      kind: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'text',
      },
      meta: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      replyToId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      // Sender-generated idempotency key; unique per sender.
      clientMessageId: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      // End-to-end encrypted envelope; the server cannot read it. `body` stays empty when set.
      e2ee: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      // Admin-only: never include in user-facing payloads.
      originalBody: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          return decryptText(this.getDataValue('originalBody'));
        },
        set(value) {
          this.setDataValue('originalBody', encryptText(value));
        },
      },
    },
    {
      sequelize,
      modelName: 'Message',
      tableName: 'messages',
      hooks: {
        // Last line of defence: any create/edit path stores masked contact info.
        beforeSave(message) {
          if (message.changed('body') && typeof message.body === 'string') {
            message.body = maskChatText(message.body);
          }
        },
        beforeBulkCreate(messages) {
          messages.forEach((message) => {
            if (typeof message.body === 'string') message.body = maskChatText(message.body);
          });
        },
        beforeBulkUpdate(options) {
          if (typeof options.attributes?.body === 'string') {
            options.attributes.body = encryptText(maskChatText(decryptText(options.attributes.body)));
          }
          if (typeof options.attributes?.originalBody === 'string') {
            options.attributes.originalBody = encryptText(options.attributes.originalBody);
          }
        },
      },
    }
  );

  return Message;
};
