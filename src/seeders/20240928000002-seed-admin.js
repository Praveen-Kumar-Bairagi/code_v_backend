'use strict';

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    await queryInterface.bulkInsert('admins', [
      {
        id: uuidv4(),
        email: 'admin@compameet.com',
        passwordHash,
        name: 'Compameet Admin',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('admins', {
      email: 'admin@compameet.com',
    });
  },
};
