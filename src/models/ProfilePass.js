'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProfilePass extends Model {
    static associate(models) {
      ProfilePass.belongsTo(models.User, {
        foreignKey: 'fromUserId',
        as: 'fromUser',
      });
      ProfilePass.belongsTo(models.User, {
        foreignKey: 'toUserId',
        as: 'toUser',
      });
    }
  }

  ProfilePass.init(
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
    },
    {
      sequelize,
      modelName: 'ProfilePass',
      tableName: 'profile_passes',
      timestamps: true,
    }
  );

  return ProfilePass;
};
