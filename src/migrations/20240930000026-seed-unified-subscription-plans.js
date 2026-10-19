'use strict';

const { v4: uuidv4 } = require('uuid');

const PLANS = [
  {
    name: 'Monthly',
    priceRupees: 199,
    durationDays: 30,
    sortOrder: 10,
    tagline: 'Try Compameet',
  },
  {
    name: '6 Months',
    priceRupees: 599,
    durationDays: 180,
    sortOrder: 20,
    tagline: 'Best value mid-term',
  },
  {
    name: '1 Year',
    priceRupees: 799,
    durationDays: 365,
    sortOrder: 30,
    tagline: 'Lowest per-month rate',
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT name FROM subscription_plans`
    );
    const have = new Set((existing || []).map((r) => String(r.name).toLowerCase()));

    const rows = [];
    for (const plan of PLANS) {
      if (have.has(plan.name.toLowerCase())) {
        await queryInterface.sequelize.query(
          `UPDATE subscription_plans
           SET "priceRupees" = :priceRupees,
               "durationDays" = :durationDays,
               "sortOrder" = :sortOrder,
               tagline = :tagline,
               "isActive" = true,
               "updatedAt" = :now
           WHERE LOWER(name) = LOWER(:name)`,
          { replacements: { ...plan, now } }
        );
      } else {
        rows.push({
          id: uuidv4(),
          ...plan,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    if (rows.length) {
      await queryInterface.bulkInsert('subscription_plans', rows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('subscription_plans', {
      name: PLANS.map((p) => p.name),
    });
  },
};
