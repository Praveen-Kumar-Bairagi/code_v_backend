'use strict';

const path = require('path');
const { v4: uuidv4 } = require('uuid');

const cityData = require(path.join(__dirname, '..', '..', 'city.json'));

function flattenCities() {
  const rows = [];
  for (const group of cityData) {
    const state = String(group.state || '').trim();
    for (const raw of group.cities || []) {
      const name = String(raw || '').trim();
      if (name && state) rows.push({ name, state });
    }
  }
  return rows;
}

/** Idempotent — safe to re-run; fills state on existing rows without one. */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const now = new Date();
    const [existing] = await sequelize.query('SELECT id, name, state FROM cities');

    const byNameState = new Set(
      existing.map((c) => `${c.name.toLowerCase()}|${String(c.state || '').toLowerCase()}`)
    );
    const stateless = new Map(
      existing.filter((c) => !c.state).map((c) => [c.name.toLowerCase(), c])
    );

    const inserts = [];
    for (const { name, state } of flattenCities()) {
      const key = `${name.toLowerCase()}|${state.toLowerCase()}`;
      if (byNameState.has(key)) continue;

      const legacy = stateless.get(name.toLowerCase());
      if (legacy) {
        await sequelize.query('UPDATE cities SET state = :state, "updatedAt" = :now WHERE id = :id', {
          replacements: { state, now, id: legacy.id },
        });
        stateless.delete(name.toLowerCase());
      } else {
        inserts.push({
          id: uuidv4(),
          name,
          state,
          isActive: true,
          sortOrder: null,
          createdAt: now,
          updatedAt: now,
        });
      }
      byNameState.add(key);
    }

    if (inserts.length) {
      await queryInterface.bulkInsert('cities', inserts);
    }
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    for (const { name, state } of flattenCities()) {
      await sequelize.query(
        `DELETE FROM cities c
         WHERE c.name = :name AND c.state = :state AND c."sortOrder" IS NULL
           AND NOT EXISTS (SELECT 1 FROM users u WHERE u."cityId" = c.id)`,
        { replacements: { name, state } }
      );
    }
  },
};
