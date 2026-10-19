'use strict';

/** Male minimum age 23 → 21: update the age wording inside stored legal documents (keeps admin edits). */
const swap = (from, to) => `regexp_replace(content, '(male[^.\\n]{0,40}?)${from}', '\\1${to}', 'gi')`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE legal_documents SET content = ${swap(23, 21)}, "updatedAt" = now()
       WHERE content ~* 'male[^.\\n]{0,40}?23'`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE legal_documents SET content = ${swap(21, 23)}, "updatedAt" = now()
       WHERE content ~* 'male[^.\\n]{0,40}?21'`
    );
  },
};
