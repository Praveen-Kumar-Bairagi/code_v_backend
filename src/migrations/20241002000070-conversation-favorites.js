'use strict';

/** Per-participant "favorite" flag on a conversation (a Plus feature); null = not a favorite. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('conversations', 'participantOneFavoritedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('conversations', 'participantTwoFavoritedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('conversations', 'participantTwoFavoritedAt');
    await queryInterface.removeColumn('conversations', 'participantOneFavoritedAt');
  },
};
