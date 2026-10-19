'use strict';

const REPLACEMENTS = [
  [
    'contact local emergency services or the police (for example **112** in India).',
    'contact your local emergency services or the police.',
  ],
  [
    'call local emergency services (112 in India).',
    'call your local emergency services.',
  ],
  ['In an emergency, call 112.', 'In an emergency, call your local emergency number.'],
];

/** Removes the India-only 112 emergency number from published legal documents. */
module.exports = {
  async up(queryInterface) {
    for (const [from, to] of REPLACEMENTS) {
      await queryInterface.sequelize.query(
        `UPDATE legal_documents
         SET content = replace(content, :from, :to), version = COALESCE(version, 1) + 1, "updatedAt" = now()
         WHERE position(:from in content) > 0`,
        { replacements: { from, to } }
      );
    }
  },

  async down(queryInterface) {
    for (const [from, to] of REPLACEMENTS) {
      await queryInterface.sequelize.query(
        `UPDATE legal_documents
         SET content = replace(content, :to, :from), version = GREATEST(COALESCE(version, 1) - 1, 1), "updatedAt" = now()
         WHERE position(:to in content) > 0`,
        { replacements: { from, to } }
      );
    }
  },
};
