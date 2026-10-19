'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PlanType extends Model {}

  PlanType.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      emoji: { type: DataTypes.STRING(16), allowNull: true },
      description: { type: DataTypes.STRING(200), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, modelName: 'PlanType', tableName: 'plan_types' }
  );

  return PlanType;
};
