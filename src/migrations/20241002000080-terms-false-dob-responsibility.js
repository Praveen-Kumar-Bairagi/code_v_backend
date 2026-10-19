'use strict';

const FROM = 'that the date of birth and gender you provide are accurate. Religion';
const TO =
  'that the date of birth and gender you provide are accurate. If you enter a false date of birth, you are responsible for it and for any consequences. Religion';

/** Terms: a member who enters a false date of birth is responsible for it. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE legal_documents
       SET content = replace(content, :from, :to), version = COALESCE(version, 1) + 1, "updatedAt" = now()
       WHERE slug IN ('terms-of-service', 'terms') AND position(:from in content) > 0`,
      { replacements: { from: FROM, to: TO } }
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE legal_documents
       SET content = replace(content, :to, :from), version = GREATEST(COALESCE(version, 1) - 1, 1), "updatedAt" = now()
       WHERE slug IN ('terms-of-service', 'terms') AND position(:to in content) > 0`,
      { replacements: { from: FROM, to: TO } }
    );
  },
};
