'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('subscription_plans', 'tier', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'chat',
    });
    await queryInterface.addColumn('messages', 'kind', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'text',
    });
    await queryInterface.addColumn('messages', 'meta', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      `UPDATE subscription_plans SET tier = 'plus' WHERE "durationDays" >= 150`
    );
    await queryInterface.sequelize.query(
      `UPDATE subscription_plans
       SET name = 'Chat', tagline = 'Mutual chat access'
       WHERE name = 'Monthly' AND "durationDays" = 30`
    );

    const now = new Date();
    await queryInterface.bulkInsert('subscription_plans', [
      {
        id: randomUUID(),
        name: 'Connect',
        priceRupees: 499,
        durationDays: 30,
        isActive: true,
        sortOrder: 12,
        tagline: 'Chat + conversation games',
        bonusCoins: 150,
        tier: 'connect',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        name: 'Plus',
        priceRupees: 699,
        durationDays: 30,
        isActive: true,
        sortOrder: 14,
        tagline: 'Chat + all games & ice-breakers',
        bonusCoins: 150,
        tier: 'plus',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('subscription_plans', { name: ['Connect', 'Plus'] });
    await queryInterface.removeColumn('messages', 'meta');
    await queryInterface.removeColumn('messages', 'kind');
    await queryInterface.removeColumn('subscription_plans', 'tier');
  },
};
