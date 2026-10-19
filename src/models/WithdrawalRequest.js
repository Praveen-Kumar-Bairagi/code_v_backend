'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WithdrawalRequest extends Model {
    static associate(models) {
      WithdrawalRequest.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
      WithdrawalRequest.belongsTo(models.Admin, {
        foreignKey: 'reviewedByAdminId',
        as: 'reviewedBy',
      });
      WithdrawalRequest.belongsTo(models.WalletTransaction, {
        foreignKey: 'walletTransactionId',
        as: 'walletTransaction',
      });
    }
  }

  WithdrawalRequest.init(
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
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      upiId: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      adminNote: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      reviewedByAdminId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      walletTransactionId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      payoutId: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      /** RazorpayX payout status: queued | pending | processing | processed | reversed | failed | manual */
      payoutStatus: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      payoutUtr: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      payoutFailureReason: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'WithdrawalRequest',
      tableName: 'withdrawal_requests',
      timestamps: true,
    }
  );

  return WithdrawalRequest;
};
