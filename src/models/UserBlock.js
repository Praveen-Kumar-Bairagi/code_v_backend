'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserBlock extends Model {
    static associate(models) {
      UserBlock.belongsTo(models.User, {
        foreignKey: 'blockerId',
        as: 'blocker',
      });
      UserBlock.belongsTo(models.User, {
        foreignKey: 'blockedId',
        as: 'blocked',
      });
    }
  }

  UserBlock.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      blockerId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      blockedId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'UserBlock',
      tableName: 'user_blocks',
      timestamps: true,
    }
  );

  return UserBlock;
};
