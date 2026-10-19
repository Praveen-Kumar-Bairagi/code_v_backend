'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PlanInterest extends Model {
    static associate(models) {
      PlanInterest.belongsTo(models.UserPlan, { foreignKey: 'planId', as: 'plan' });
      PlanInterest.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  PlanInterest.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      planId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      /** interested | not_interested */
      status: { type: DataTypes.STRING(20), allowNull: false },
      conversationId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, modelName: 'PlanInterest', tableName: 'plan_interests' }
  );

  return PlanInterest;
};
