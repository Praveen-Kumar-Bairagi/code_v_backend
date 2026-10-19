'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CoinPack extends Model {
    static associate() {}
  }

  CoinPack.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      coins: { type: DataTypes.INTEGER, allowNull: false },
      priceRupees: { type: DataTypes.INTEGER, allowNull: false },
      tagline: { type: DataTypes.STRING(160), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'CoinPack',
      tableName: 'coin_packs',
      timestamps: true,
    }
  );

  return CoinPack;
};
