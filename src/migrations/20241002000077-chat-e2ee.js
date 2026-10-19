'use strict';

/** End-to-end encrypted chat: per-device public keys and the encrypted envelope on messages. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('e2ee_device_keys', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      deviceId: { type: Sequelize.STRING(64), allowNull: false },
      publicKey: { type: Sequelize.STRING(64), allowNull: false },
      lastSeenAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('e2ee_device_keys', ['userId', 'deviceId'], {
      unique: true,
      name: 'e2ee_device_keys_user_device',
    });
    await queryInterface.addColumn('messages', 'e2ee', { type: Sequelize.JSONB, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('messages', 'e2ee');
    await queryInterface.dropTable('e2ee_device_keys');
  },
};
