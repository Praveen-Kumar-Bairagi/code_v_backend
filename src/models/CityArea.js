'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CityArea extends Model {
    static associate(models) {
      CityArea.belongsTo(models.City, { foreignKey: 'cityId', as: 'city' });
    }
  }

  CityArea.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      cityId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      latitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
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
    },
    {
      sequelize,
      modelName: 'CityArea',
      tableName: 'city_areas',
      timestamps: true,
    }
  );

  return CityArea;
};
