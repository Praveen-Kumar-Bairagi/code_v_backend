'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AdminBroadcast extends Model {
    static associate(models) {
      AdminBroadcast.belongsTo(models.Admin, { foreignKey: 'adminId', as: 'admin' });
    }
  }

  AdminBroadcast.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      adminId: { type: DataTypes.UUID, allowNull: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      audience: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      recipientCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      deviceCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      pushSentCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      pushFailedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'sending' },
    },
    { sequelize, modelName: 'AdminBroadcast', tableName: 'admin_broadcasts', timestamps: true }
  );

  return AdminBroadcast;
};
