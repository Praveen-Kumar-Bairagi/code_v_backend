'use strict';

const { randomUUID } = require('crypto');

/** Chat wallpapers. A conversation with no theme (null) uses the built-in Default look. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_themes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING(60), allowNull: false },
      kind: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'color' },
      color: { type: Sequelize.STRING(20), allowNull: true },
      gradientFrom: { type: Sequelize.STRING(20), allowNull: true },
      gradientTo: { type: Sequelize.STRING(20), allowNull: true },
      imageUrl: { type: Sequelize.STRING(500), allowNull: true },
      isDark: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addColumn('conversations', 'chatThemeId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'chat_themes', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('conversations', 'chatThemeSetById', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('conversations', 'chatThemeSetAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    const now = new Date();
    await queryInterface.bulkInsert('chat_themes', [
      {
        id: randomUUID(),
        name: 'Dark',
        kind: 'gradient',
        gradientFrom: '#0F172A',
        gradientTo: '#1E1B4B',
        isDark: true,
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        name: 'Flowers',
        kind: 'image',
        imageUrl: '/public/chat-themes/builtin/flowers.jpg',
        color: '#FDF2F0',
        isDark: false,
        sortOrder: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        name: 'Blur',
        kind: 'image',
        imageUrl: '/public/chat-themes/builtin/blur.jpg',
        color: '#E9D5FF',
        isDark: false,
        sortOrder: 3,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('conversations', 'chatThemeSetAt');
    await queryInterface.removeColumn('conversations', 'chatThemeSetById');
    await queryInterface.removeColumn('conversations', 'chatThemeId');
    await queryInterface.dropTable('chat_themes');
  },
};
