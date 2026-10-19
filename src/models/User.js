'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.City, { foreignKey: 'cityId', as: 'city' });
      User.hasMany(models.Booking, { foreignKey: 'senderId', as: 'sentBookings' });
      User.hasMany(models.Booking, { foreignKey: 'receiverId', as: 'receivedBookings' });
      User.hasMany(models.WalletTransaction, {
        foreignKey: 'userId',
        as: 'walletTransactions',
      });
      User.hasMany(models.DeviceSession, {
        foreignKey: 'userId',
        as: 'deviceSessions',
      });
      User.hasMany(models.Subscription, {
        foreignKey: 'userId',
        as: 'subscriptions',
      });
    }

    toSafeJSON() {
      return { ...this.get() };
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      /** Null for Google sign-ups until they verify a mobile number. */
      mobileNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      /** Firebase UID of the linked Google account. */
      googleUid: {
        type: DataTypes.STRING(128),
        allowNull: true,
        unique: true,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      gender: {
        type: DataTypes.ENUM('male', 'female', 'other'),
        allowNull: false,
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      cityId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      accountStatus: {
        type: DataTypes.ENUM('active', 'inactive', 'blocked', 'suspended'),
        allowNull: false,
        defaultValue: 'active',
      },
      hasUserProfile: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      hasCompanionProfile: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      pincode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      upiId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      aboutMe: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      pendingBio: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      bioStatus: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'none',
      },
      education: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profession: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      religion: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      coinBalance: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      drinking: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      smoking: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      eating: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      relationshipStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lookingFor: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      interests: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      photos: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      selectedServiceIds: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      availability: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      hideAge: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      termsAcceptedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      settings: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      photoVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      facebookVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      kycVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      kycFileName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      walletBalance: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      onboardingStep: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
      },
      onboardingCompleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isCreator: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /** Unique public creator id (admin-editable only); kept after expiry so it stays reserved */
      creatorHandle: {
        type: DataTypes.STRING(40),
        allowNull: true,
        unique: true,
      },
      creatorExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      /** Free (no-subscription) booking credits; used up on create/accept, never refunded on cancel */
      freeBookingCreatesLeft: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      freeBookingAcceptsLeft: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      lastActiveAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Last 3-monthly reminder of our rules (IT Rules 2021, Rule 3(1)(c)).
      policyReminderAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      locationUpdatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      chatViolationCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      chatWarningCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      chatSuspended: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      chatSuspendedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
    }
  );

  return User;
};
