'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('cities', [
      {
        id: uuidv4(),
        name: 'Indore',
        isActive: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Bhopal',
        isActive: true,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uuidv4(),
        name: 'Ujjain',
        isActive: true,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('cities', {
      name: { [Op.in]: ['Indore', 'Bhopal', 'Ujjain'] },
    });
  },
};
