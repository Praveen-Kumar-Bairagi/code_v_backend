'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sms_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      mobile: { type: Sequelize.STRING(20), allowNull: false },
      kind: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'otp' },
      purpose: { type: Sequelize.STRING(40), allowNull: true },
      templateId: { type: Sequelize.STRING(60), allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false },
      httpStatus: { type: Sequelize.INTEGER, allowNull: true },
      requestId: { type: Sequelize.STRING(120), allowNull: true },
      responseMessage: { type: Sequelize.STRING(500), allowNull: true },
      response: { type: Sequelize.JSONB, allowNull: true },
      durationMs: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('sms_logs', ['createdAt'], { name: 'sms_logs_created_idx' });
    await queryInterface.addIndex('sms_logs', ['status', 'createdAt'], { name: 'sms_logs_status_created_idx' });
    await queryInterface.addIndex('sms_logs', ['mobile'], { name: 'sms_logs_mobile_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sms_logs');
  },
};
