'use strict';

const { Model } = require('sequelize');
const {
  BOOKING_STATUS_VALUES,
} = require('../constants/bookingStatus');

module.exports = (sequelize, DataTypes) => {
  class Booking extends Model {
    static associate(models) {
      Booking.belongsTo(models.User, { foreignKey: 'senderId', as: 'sender' });
      Booking.belongsTo(models.User, { foreignKey: 'receiverId', as: 'receiver' });
      Booking.belongsTo(models.City, { foreignKey: 'cityId', as: 'city' });
      Booking.belongsTo(models.CompanionCategory, {
        foreignKey: 'categoryId',
        as: 'category',
      });
      Booking.hasMany(models.BookingRequest, {
        foreignKey: 'bookingId',
        as: 'requests',
      });
    }
  }

  Booking.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      receiverId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(...BOOKING_STATUS_VALUES),
        allowNull: false,
        defaultValue: 'pending',
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      durationMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      placeId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      locationLat: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      locationLng: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      notes: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      cityId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      preferredGender: {
        type: DataTypes.ENUM('all', 'male', 'female'),
        allowNull: true,
      },
      bookingPolicyAccepted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      paymentStatus: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'unpaid',
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      confirmedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      paymentDueAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelReason: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      userMeetCode: {
        type: DataTypes.STRING(12),
        allowNull: true,
      },
      companionMeetCode: {
        type: DataTypes.STRING(12),
        allowNull: true,
      },
      userCodeVerifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      companionCodeVerifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      endsAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Booking',
      tableName: 'bookings',
      validate: {
        senderNotReceiver() {
          if (this.senderId && this.receiverId && this.senderId === this.receiverId) {
            throw new Error('senderId cannot equal receiverId');
          }
        },
      },
    }
  );

  return Booking;
};
