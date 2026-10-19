'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class LegalDocument extends Model {
    static associate() {}
  }

  LegalDocument.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      requiresAcceptance: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      audience: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'all',
      },
    },
    {
      sequelize,
      modelName: 'LegalDocument',
      tableName: 'legal_documents',
      timestamps: true,
    }
  );

  return LegalDocument;
};
