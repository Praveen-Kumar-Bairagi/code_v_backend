'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CreatorRequest extends Model {
    static associate(models) {
      CreatorRequest.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      CreatorRequest.belongsTo(models.Admin, { foreignKey: 'reviewedByAdminId', as: 'reviewedBy' });
    }
  }

  CreatorRequest.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      email: { type: DataTypes.STRING(160), allowNull: false },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      note: { type: DataTypes.STRING(500), allowNull: true },
      /** pending | approved | rejected */
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
      adminNote: { type: DataTypes.STRING(500), allowNull: true },
      durationMonths: { type: DataTypes.INTEGER, allowNull: true },
      reviewedByAdminId: { type: DataTypes.UUID, allowNull: true },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'CreatorRequest',
      tableName: 'creator_requests',
      timestamps: true,
    }
  );

  return CreatorRequest;
};
