'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Postgres FK columns need raw SQL to drop NOT NULL reliably
    await queryInterface.sequelize.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "receiverId" DROP NOT NULL;
    `);

    await queryInterface.changeColumn('bookings', 'scheduledAt', {
      type: Sequelize.DATE,
      allowNull: false,
    });

    await queryInterface.addColumn('bookings', 'categoryId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'companion_categories', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('bookings', 'preferredGender', {
      type: Sequelize.ENUM('all', 'male', 'female'),
      allowNull: true,
    });

    await queryInterface.addColumn('bookings', 'bookingPolicyAccepted', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addIndex('bookings', ['categoryId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('bookings', ['categoryId']);
    await queryInterface.removeColumn('bookings', 'bookingPolicyAccepted');
    await queryInterface.removeColumn('bookings', 'preferredGender');
    await queryInterface.removeColumn('bookings', 'categoryId');

    await queryInterface.changeColumn('bookings', 'scheduledAt', {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });

    await queryInterface.changeColumn('bookings', 'receiverId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_bookings_preferredGender";'
    );
  },
};
