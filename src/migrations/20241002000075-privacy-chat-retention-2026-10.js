'use strict';

const privacyContent = require('../content/privacyPolicy');

/** Publishes the Privacy Policy with verified chat filtering, staff access, retention and security wording (version + 1). */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE legal_documents
       SET content = :content, version = COALESCE(version, 1) + 1, "updatedAt" = now()
       WHERE slug IN ('privacy-policy', 'privacy') AND content IS DISTINCT FROM :content`,
      { replacements: { content: privacyContent } }
    );
  },

  // Previous wording is not restored here — only the version number is reverted.
  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE legal_documents SET version = GREATEST(COALESCE(version, 1) - 1, 1)
       WHERE slug IN ('privacy-policy', 'privacy')`
    );
  },
};
