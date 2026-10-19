'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PlatformSetting extends Model {
    static associate() {}
  }

  PlatformSetting.init(
    {
      key: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
    },
    {
      sequelize,
      modelName: 'PlatformSetting',
      tableName: 'platform_settings',
    }
  );

  return PlatformSetting;
};
