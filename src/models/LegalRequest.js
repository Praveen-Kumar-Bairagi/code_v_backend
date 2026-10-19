'use strict';

const { Model } = require('sequelize');

/** A request for user data from a court or government agency, and when we answered it. */
module.exports = (sequelize, DataTypes) => {
  class LegalRequest extends Model {}

  LegalRequest.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      adminId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      agency: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      referenceNo: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      legalBasis: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      receivedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      lastExportedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'LegalRequest',
      tableName: 'legal_requests',
      timestamps: true,
    }
  );

  return LegalRequest;
};
