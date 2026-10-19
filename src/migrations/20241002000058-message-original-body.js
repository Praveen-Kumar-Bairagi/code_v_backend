'use strict';

/** Unmasked text of a moderated message, visible to admins only. Null when nothing was masked. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages', 'originalBody', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('messages', 'originalBody');
  },
};
