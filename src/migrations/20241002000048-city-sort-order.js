'use strict';

/**
 * Only a few cities had a sort order; the rest were NULL. Number every
 * remaining city after the highest existing value, alphabetically.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      WITH base AS (SELECT COALESCE(MAX("sortOrder"), 0) AS m FROM cities WHERE "sortOrder" > 0),
      ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY name, state NULLS FIRST, id) AS rn
          FROM cities
         WHERE "sortOrder" IS NULL OR "sortOrder" <= 0
      )
      UPDATE cities c
         SET "sortOrder" = base.m + ranked.rn
        FROM ranked, base
       WHERE c.id = ranked.id
    `);
  },

  async down() {
    // Sort orders are data; nothing to undo safely.
  },
};
