'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanionCategoryGroup extends Model {
    static associate(models) {
      CompanionCategoryGroup.hasMany(models.CompanionCategory, {
        foreignKey: 'groupId',
        as: 'categories',
      });
    }
  }

  CompanionCategoryGroup.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      emoji: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: '✨',
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'CompanionCategoryGroup',
      tableName: 'companion_category_groups',
      timestamps: true,
    }
  );

  return CompanionCategoryGroup;
};
