'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserPlan extends Model {
    static associate(models) {
      UserPlan.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      UserPlan.belongsTo(models.PlanType, { foreignKey: 'planTypeId', as: 'planType' });
      UserPlan.belongsTo(models.City, { foreignKey: 'cityId', as: 'city' });
      UserPlan.belongsTo(models.CityArea, { foreignKey: 'cityAreaId', as: 'area' });
      UserPlan.hasMany(models.PlanInterest, { foreignKey: 'planId', as: 'interests' });
    }
  }

  UserPlan.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      planTypeId: { type: DataTypes.UUID, allowNull: true },
      planName: { type: DataTypes.STRING(80), allowNull: false },
      planEmoji: { type: DataTypes.STRING(16), allowNull: true },
      cityId: { type: DataTypes.UUID, allowNull: false },
      cityAreaId: { type: DataTypes.UUID, allowNull: true },
      areaName: { type: DataTypes.STRING(120), allowNull: true },
      latitude: { type: DataTypes.DOUBLE, allowNull: true },
      longitude: { type: DataTypes.DOUBLE, allowNull: true },
      scheduledAt: { type: DataTypes.DATE, allowNull: false },
      /** all | male | female — who gets notified / sees the plan */
      preferredGender: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'all' },
      /** active | cancelled (time-expired plans stay "active" but drop out of queries) */
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
      termsAcceptedAt: { type: DataTypes.DATE, allowNull: false },
      notifiedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, modelName: 'UserPlan', tableName: 'user_plans' }
  );

  return UserPlan;
};
