'use strict';

const { Model } = require('sequelize');
const { BOOKING_REQUEST_STATUS_VALUES } = require('../constants/bookingStatus');

module.exports = (sequelize, DataTypes) => {
  class BookingRequest extends Model {
    static associate(models) {
      BookingRequest.belongsTo(models.Booking, {
        foreignKey: 'bookingId',
        as: 'booking',
      });
      BookingRequest.belongsTo(models.User, {
        foreignKey: 'receiverId',
        as: 'receiver',
      });
    }
  }

  BookingRequest.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      bookingId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      receiverId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...BOOKING_REQUEST_STATUS_VALUES),
        allowNull: false,
        defaultValue: 'pending',
      },
      offeredAmount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      acceptedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      respondedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      respondBy: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      selectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'BookingRequest',
      tableName: 'booking_requests',
      timestamps: true,
    }
  );

  return BookingRequest;
};
