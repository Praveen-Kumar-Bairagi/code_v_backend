'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SupportSubject extends Model {
    static associate() {
      // SupportRequest wiring later when tickets are added
    }
  }

  SupportSubject.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      isOther: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: 'SupportSubject',
      tableName: 'support_subjects',
      timestamps: true,
    }
  );

  return SupportSubject;
};
