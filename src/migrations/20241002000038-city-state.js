'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('cities', 'state', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    // Same city name exists in different states (e.g. Bilaspur, Udaipur)
    await queryInterface.sequelize.query(
      'ALTER TABLE "cities" DROP CONSTRAINT IF EXISTS "cities_name_key"'
    );
    await queryInterface.addIndex('cities', ['name', 'state'], {
      unique: true,
      name: 'cities_name_state_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('cities', 'cities_name_state_unique');
    await queryInterface.removeColumn('cities', 'state');
    await queryInterface.addConstraint('cities', {
      fields: ['name'],
      type: 'unique',
      name: 'cities_name_key',
    });
  },
};
