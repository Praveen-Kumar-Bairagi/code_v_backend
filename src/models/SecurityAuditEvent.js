'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SecurityAuditEvent extends Model {}

  SecurityAuditEvent.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      actorType: { type: DataTypes.STRING(16), allowNull: false },
      actorId: { type: DataTypes.UUID, allowNull: true },
      action: { type: DataTypes.STRING(64), allowNull: false },
      targetUserId: { type: DataTypes.UUID, allowNull: true },
      meta: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      sequelize,
      modelName: 'SecurityAuditEvent',
      tableName: 'security_audit_events',
      timestamps: true,
      updatedAt: false,
    }
  );

  return SecurityAuditEvent;
};
