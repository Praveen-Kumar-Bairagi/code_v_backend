'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('creator_requests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      email: {
        type: Sequelize.STRING(160),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      note: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
      },
      adminNote: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      reviewedByAdminId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('creator_requests', ['userId']);
    await queryInterface.addIndex('creator_requests', ['status', 'createdAt']);
    // One open request per user, enforced by the DB as well
    await queryInterface.addIndex('creator_requests', ['userId'], {
      unique: true,
      where: { status: 'pending' },
      name: 'creator_requests_one_pending_per_user',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('creator_requests');
  },
};
