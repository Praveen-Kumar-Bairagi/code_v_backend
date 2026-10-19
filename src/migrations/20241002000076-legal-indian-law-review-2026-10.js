'use strict';

const privacyContent = require('../content/privacyPolicy');
const termsContent = require('../content/termsOfService');

const DOCS = [
  { slugs: ['privacy-policy', 'privacy'], content: privacyContent },
  { slugs: ['terms-of-service', 'terms'], content: termsContent },
];

/** Publishes the Indian-law reviewed Privacy Policy and Terms (version + 1). Run only after legal sign-off. */
module.exports = {
  async up(queryInterface) {
    for (const { slugs, content } of DOCS) {
      await queryInterface.sequelize.query(
        `UPDATE legal_documents
         SET content = :content, version = COALESCE(version, 1) + 1, "updatedAt" = now()
         WHERE slug IN (:slugs) AND content IS DISTINCT FROM :content`,
        { replacements: { content, slugs } }
      );
    }
  },

  // Previous wording is not restored here — only the version number is reverted.
  async down(queryInterface) {
    for (const { slugs } of DOCS) {
      await queryInterface.sequelize.query(
        `UPDATE legal_documents SET version = GREATEST(COALESCE(version, 1) - 1, 1)
         WHERE slug IN (:slugs)`,
        { replacements: { slugs } }
      );
    }
  },
};
