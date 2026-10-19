'use strict';

/** Per-participant mute (no chat pushes) and archive (hidden from the main list); null = off. */
const COLUMNS = [
  'participantOneMutedAt',
  'participantTwoMutedAt',
  'participantOneArchivedAt',
  'participantTwoArchivedAt',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const column of COLUMNS) {
      await queryInterface.addColumn('conversations', column, {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    for (const column of [...COLUMNS].reverse()) {
      await queryInterface.removeColumn('conversations', column);
    }
  },
};
