'use strict';

const crypto = require('crypto');

/**
 * City areas (sub-locations of a city) with coordinates.
 * Seed coordinates come from Google Places Text Search (Oct 2026).
 */

const AREAS = {
  Indore: [
    ['Vijay Nagar', 22.75521, 75.896820],
    ['Rajwada', 22.71771, 75.854480],
    ['Mahalaxmi Nagar', 22.75902, 75.912930],
    ['New Palasia', 22.72435, 75.883890],
    ['Old Palasia', 22.72551, 75.888610],
    ['Sapna Sangeeta', 22.69903, 75.867090],
    ['Bhawarkuan', 22.68451, 75.864460],
    ['Rau', 22.63994, 75.803340],
    ['Nipania', 22.76174, 75.927320],
    ['Scheme No. 54', 22.74968, 75.891330],
    ['Scheme No. 78', 22.76573, 75.885960],
    ['Sudama Nagar', 22.69170, 75.831390],
    ['Annapurna', 22.69017, 75.838180],
    ['Khajrana', 22.73546, 75.907360],
    ['LIG Colony', 22.73810, 75.887260],
    ['Bengali Square', 22.71937, 75.908580],
    ['Rajendra Nagar', 22.67092, 75.827520],
    ['Sarafa Bazaar', 22.71751, 75.852310],
    ['Saket Nagar', 22.72340, 75.897690],
    ['MG Road', 22.71980, 75.868400],
    ['Navlakha', 22.69866, 75.881720],
    ['Bicholi Mardana', 22.70814, 75.922960],
  ],
  Bhopal: [
    ['MP Nagar', 23.23134, 77.432650],
    ['New Market', 23.23564, 77.400620],
    ['Arera Colony', 23.21158, 77.431100],
    ['Kolar Road', 23.17190, 77.416870],
    ['Hoshangabad Road', 23.15452, 77.474740],
    ['Bairagarh', 23.27924, 77.333630],
    ['Shahpura', 23.19012, 77.424260],
    ['TT Nagar', 23.23575, 77.398650],
    ['Habibganj', 23.21117, 77.451070],
    ['Indrapuri', 23.25713, 77.460650],
    ['Ayodhya Bypass', 23.27484, 77.467660],
    ['Lalghati', 23.28114, 77.360530],
    ['Chowk Bazaar', 23.25882, 77.401680],
    ['Bittan Market', 23.21599, 77.429730],
    ['VIP Road', 23.26097, 77.380720],
    ['Gulmohar Colony', 23.18445, 77.437900],
    ['Awadhpuri', 23.22428, 77.488490],
    ['Karond', 23.29507, 77.403720],
    ['Misrod', 23.16164, 77.469410],
    ['Bawadiya Kalan', 23.18087, 77.438650],
  ],
  Ujjain: [
    ['Freeganj', 23.17850, 75.791650],
    ['Mahakal Mandir', 23.18294, 75.768250],
    ['Nanakheda', 23.15652, 75.790200],
    ['Madhav Nagar', 23.17916, 75.790920],
    ['Tower Chowk', 23.17928, 75.788620],
    ['Rishi Nagar', 23.16486, 75.793830],
    ['University Road', 23.16782, 75.802730],
    ['Mahananda Nagar', 23.15401, 75.802550],
    ['Ram Ghat', 23.18810, 75.765160],
    ['Sethi Nagar', 23.17545, 75.798190],
    ['Kothi Road', 23.16191, 75.808190],
    ['Agar Road', 23.19868, 75.788240],
    ['Chamunda Chowk', 23.18327, 75.782580],
  ],
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('city_areas', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      cityId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'cities', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING(120), allowNull: false },
      latitude: { type: Sequelize.DOUBLE, allowNull: true },
      longitude: { type: Sequelize.DOUBLE, allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('city_areas', ['cityId']);
    await queryInterface.addIndex('city_areas', ['cityId', 'name'], { unique: true });

    const now = new Date();
    for (const [cityName, areas] of Object.entries(AREAS)) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT id FROM cities WHERE LOWER(TRIM(name)) = :name
          ORDER BY "isActive" DESC, "sortOrder" ASC NULLS LAST LIMIT 1`,
        { replacements: { name: cityName.toLowerCase() } }
      );
      const cityId = rows[0]?.id;
      if (!cityId) continue;
      await queryInterface.bulkInsert(
        'city_areas',
        areas.map(([name, latitude, longitude], index) => ({
          id: crypto.randomUUID(),
          cityId,
          name,
          latitude,
          longitude,
          isActive: true,
          sortOrder: index + 1,
          createdAt: now,
          updatedAt: now,
        }))
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('city_areas');
  },
};
