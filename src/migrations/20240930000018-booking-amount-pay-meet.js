'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface.sequelize;

    const addEnum = async (typeName, value) => {
      await qi.query(`
        DO $$ BEGIN
          ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${value}';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    };

    await addEnum('enum_bookings_status', 'responses_available');
    await addEnum('enum_bookings_status', 'payment_pending');
    await addEnum('enum_bookings_status', 'confirmed');
    await addEnum('enum_bookings_status', 'in_progress');

    await addEnum('enum_booking_requests_status', 'selected');
    await addEnum('enum_booking_requests_status', 'expired');

    await queryInterface.addColumn('booking_requests', 'offeredAmount', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('booking_requests', 'acceptedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('bookings', 'amount', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'paymentStatus', {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'unpaid',
    });
    await queryInterface.addColumn('bookings', 'paidAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'confirmedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'userMeetCode', {
      type: Sequelize.STRING(12),
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'companionMeetCode', {
      type: Sequelize.STRING(12),
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'userCodeVerifiedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'companionCodeVerifiedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'startedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'endsAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'endsAt');
    await queryInterface.removeColumn('bookings', 'startedAt');
    await queryInterface.removeColumn('bookings', 'companionCodeVerifiedAt');
    await queryInterface.removeColumn('bookings', 'userCodeVerifiedAt');
    await queryInterface.removeColumn('bookings', 'companionMeetCode');
    await queryInterface.removeColumn('bookings', 'userMeetCode');
    await queryInterface.removeColumn('bookings', 'confirmedAt');
    await queryInterface.removeColumn('bookings', 'paidAt');
    await queryInterface.removeColumn('bookings', 'paymentStatus');
    await queryInterface.removeColumn('bookings', 'amount');
    await queryInterface.removeColumn('booking_requests', 'acceptedAt');
    await queryInterface.removeColumn('booking_requests', 'offeredAmount');
  },
};
