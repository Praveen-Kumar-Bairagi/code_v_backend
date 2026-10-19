'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const docs = [
      { slug: 'terms', title: 'Terms of Service' },
      { slug: 'privacy', title: 'Privacy Policy' },
      { slug: 'safety', title: 'Safety Guidelines' },
      { slug: 'cancellation', title: 'Cancellation Policy' },
    ];
    await queryInterface.bulkInsert(
      'legal_documents',
      docs.map((d) => ({
        id: uuidv4(),
        slug: d.slug,
        title: d.title,
        content: '',
        createdAt: now,
        updatedAt: now,
      }))
    );
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('legal_documents', {
      slug: { [Op.in]: ['terms', 'privacy', 'safety', 'cancellation'] },
    });
  },
};
