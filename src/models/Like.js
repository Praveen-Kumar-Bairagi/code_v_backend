'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Like extends Model {
    static associate(models) {
      Like.belongsTo(models.User, {
        foreignKey: 'fromUserId',
        as: 'fromUser',
      });
      Like.belongsTo(models.User, {
        foreignKey: 'toUserId',
        as: 'toUser',
      });
    }
  }

  Like.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      fromUserId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      toUserId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      sequelize,
      modelName: 'Like',
      tableName: 'likes',
      timestamps: true,
    }
  );

  return Like;
};
