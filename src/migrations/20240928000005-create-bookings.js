'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bookings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
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
        type: Sequelize.ENUM(
          'pending',
          'accepted',
          'declined',
          'cancelled',
          'completed'
        ),
        allowNull: false,
        defaultValue: 'pending',
      },
      scheduledAt: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      durationMinutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 60,
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      cityId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'cities', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('bookings', ['senderId']);
    await queryInterface.addIndex('bookings', ['receiverId']);
    await queryInterface.addIndex('bookings', ['status']);
    await queryInterface.addIndex('bookings', ['scheduledAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bookings');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_bookings_status";'
    );
  },
};
