'use strict';

const { Model } = require('sequelize');

/**
 * Records kept out of sight for a fixed period after users delete them (IT Rules 2021,
 * Rule 3(1)(g) and (h)). Only the legal-request export reads them; the purge job removes them.
 */
module.exports = (sequelize, DataTypes) => {
  class LegalRetentionRecord extends Model {}

  LegalRetentionRecord.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // deleted_account | deleted_conversation | removed_photo
      kind: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      // account_deleted | blocked | unmatched | admin_removed
      reason: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      subjectUserId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      relatedUserId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      // Chat text stays exactly as stored (encrypted); never decrypted when archived.
      data: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      purgeAfter: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      // Set while a request from an authority is open; the purge job skips these.
      legalHold: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'LegalRetentionRecord',
      tableName: 'legal_retention_records',
      timestamps: true,
    }
  );

  return LegalRetentionRecord;
};
