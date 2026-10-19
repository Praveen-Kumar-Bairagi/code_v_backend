'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('legal_documents');

    if (!table.isActive) {
      await queryInterface.addColumn('legal_documents', 'isActive', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
    if (!table.version) {
      await queryInterface.addColumn('legal_documents', 'version', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      });
    }
    if (!table.sortOrder) {
      await queryInterface.addColumn('legal_documents', 'sortOrder', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!table.requiresAcceptance) {
      await queryInterface.addColumn('legal_documents', 'requiresAcceptance', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
    if (!table.audience) {
      await queryInterface.addColumn('legal_documents', 'audience', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'all',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('legal_documents');
    if (table.audience) await queryInterface.removeColumn('legal_documents', 'audience');
    if (table.requiresAcceptance) {
      await queryInterface.removeColumn('legal_documents', 'requiresAcceptance');
    }
    if (table.sortOrder) await queryInterface.removeColumn('legal_documents', 'sortOrder');
    if (table.version) await queryInterface.removeColumn('legal_documents', 'version');
    if (table.isActive) await queryInterface.removeColumn('legal_documents', 'isActive');
  },
};
