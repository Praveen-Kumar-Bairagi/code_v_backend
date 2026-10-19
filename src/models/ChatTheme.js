'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatTheme extends Model {}

  ChatTheme.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(60), allowNull: false },
      // color | gradient | image
      kind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'color' },
      color: { type: DataTypes.STRING(20), allowNull: true },
      gradientFrom: { type: DataTypes.STRING(20), allowNull: true },
      gradientTo: { type: DataTypes.STRING(20), allowNull: true },
      imageUrl: { type: DataTypes.STRING(500), allowNull: true },
      isDark: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { sequelize, modelName: 'ChatTheme', tableName: 'chat_themes' }
  );

  return ChatTheme;
};
