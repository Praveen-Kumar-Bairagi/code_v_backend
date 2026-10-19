'use strict';

const termsContent = require('../content/termsOfService');

/** Publishes the October 2026 Terms & Conditions to the stored legal documents (version + 1). */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE legal_documents
         SET content = :content, version = COALESCE(version, 1) + 1, "updatedAt" = now()
       WHERE slug IN ('terms-of-service', 'terms') AND content IS DISTINCT FROM :content`,
      { replacements: { content: termsContent } }
    );
  },

  // Previous wording is not restored here — only the version number is reverted.
  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE legal_documents SET version = GREATEST(COALESCE(version, 1) - 1, 1)
       WHERE slug IN ('terms-of-service', 'terms')`
    );
  },
};
