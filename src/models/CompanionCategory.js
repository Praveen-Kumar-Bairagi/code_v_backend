'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CompanionCategory extends Model {
    static associate(models) {
      CompanionCategory.hasMany(models.Booking, {
        foreignKey: 'categoryId',
        as: 'bookings',
      });
      CompanionCategory.belongsTo(models.CompanionCategoryGroup, {
        foreignKey: 'groupId',
        as: 'group',
      });
    }
  }

  CompanionCategory.init(
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
      color: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '#E8F4FF',
      },
      accentColor: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '#1D6FD8',
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 299,
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
      groupId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'CompanionCategory',
      tableName: 'companion_categories',
      timestamps: true,
    }
  );

  return CompanionCategory;
};
