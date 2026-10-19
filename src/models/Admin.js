'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Admin extends Model {
    static associate() {}

    toSafeJSON() {
      const { id, email, name, createdAt, updatedAt } = this.get();
      return { id, email, name, createdAt, updatedAt };
    }
  }

  Admin.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Admin',
      tableName: 'admins',
    }
  );

  return Admin;
};
