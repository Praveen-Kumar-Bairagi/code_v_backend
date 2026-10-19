'use strict';

/**
 * IT Rules 2021 support: 180-day preservation of deleted records, a log of requests from
 * authorities, session IP addresses, and the 3-monthly policy reminder.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('legal_retention_records', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      kind: { type: Sequelize.STRING(40), allowNull: false },
      reason: { type: Sequelize.STRING(40), allowNull: false },
      subjectUserId: { type: Sequelize.UUID, allowNull: true },
      relatedUserId: { type: Sequelize.UUID, allowNull: true },
      data: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      purgeAfter: { type: Sequelize.DATE, allowNull: false },
      legalHold: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('legal_retention_records', ['subjectUserId']);
    await queryInterface.addIndex('legal_retention_records', ['relatedUserId']);
    await queryInterface.addIndex('legal_retention_records', ['purgeAfter']);

    await queryInterface.createTable('legal_requests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false },
      adminId: { type: Sequelize.UUID, allowNull: true },
      agency: { type: Sequelize.STRING(200), allowNull: false },
      referenceNo: { type: Sequelize.STRING(200), allowNull: false },
      legalBasis: { type: Sequelize.STRING(200), allowNull: true },
      receivedAt: { type: Sequelize.DATE, allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      lastExportedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('legal_requests', ['userId']);

    await queryInterface.addColumn('device_sessions', 'ipAddress', { type: Sequelize.STRING(64), allowNull: true });
    await queryInterface.addColumn('device_sessions', 'lastIpAddress', { type: Sequelize.STRING(64), allowNull: true });
    await queryInterface.addColumn('users', 'policyReminderAt', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'policyReminderAt');
    await queryInterface.removeColumn('device_sessions', 'lastIpAddress');
    await queryInterface.removeColumn('device_sessions', 'ipAddress');
    await queryInterface.dropTable('legal_requests');
    await queryInterface.dropTable('legal_retention_records');
  },
};
