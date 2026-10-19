'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('booking_requests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      bookingId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'bookings', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      receiverId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'declined', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      respondedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('booking_requests', ['bookingId']);
    await queryInterface.addIndex('booking_requests', ['receiverId']);
    await queryInterface.addIndex('booking_requests', ['receiverId', 'status']);
    await queryInterface.addConstraint('booking_requests', {
      fields: ['bookingId', 'receiverId'],
      type: 'unique',
      name: 'booking_requests_booking_receiver_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('booking_requests');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_booking_requests_status";'
    );
  },
};
