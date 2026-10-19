'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('booking_requests', 'respondBy', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('booking_requests', 'selectedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('bookings', 'paymentDueAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'cancelledAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'cancelReason', {
      type: Sequelize.STRING(80),
      allowNull: true,
    });

    // Backfill respondBy for existing pending requests (1h from createdAt)
    await queryInterface.sequelize.query(`
      UPDATE booking_requests
      SET "respondBy" = "createdAt" + INTERVAL '1 hour'
      WHERE status = 'pending' AND "respondBy" IS NULL
    `);

    // Backfill paymentDueAt for payment_pending bookings
    await queryInterface.sequelize.query(`
      UPDATE bookings
      SET "paymentDueAt" = COALESCE("updatedAt", "createdAt") + INTERVAL '1 hour'
      WHERE status = 'payment_pending' AND "paymentDueAt" IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'cancelReason');
    await queryInterface.removeColumn('bookings', 'cancelledAt');
    await queryInterface.removeColumn('bookings', 'paymentDueAt');
    await queryInterface.removeColumn('booking_requests', 'selectedAt');
    await queryInterface.removeColumn('booking_requests', 'respondBy');
  },
};
