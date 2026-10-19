'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('companion_categories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      emoji: {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: '✨',
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      color: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '#E8F4FF',
      },
      accentColor: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '#1D6FD8',
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 299,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    const now = new Date();
    await queryInterface.bulkInsert('companion_categories', [
      {
        id: 'b1000000-0000-4000-8000-000000000001',
        name: 'Coffee Companion',
        emoji: '☕',
        description: 'Casual coffee meetups and conversations',
        color: '#FFF4E0',
        accentColor: '#C47A00',
        amount: 299,
        isActive: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'b1000000-0000-4000-8000-000000000002',
        name: 'Travel Buddy',
        emoji: '🧳',
        description: 'Local sightseeing and travel company',
        color: '#E8F4FF',
        accentColor: '#1D6FD8',
        amount: 499,
        isActive: true,
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'b1000000-0000-4000-8000-000000000003',
        name: 'Dinner Partner',
        emoji: '🍽️',
        description: 'Food outings and dinner companionship',
        color: '#FFE8E4',
        accentColor: '#D94B3A',
        amount: 399,
        isActive: true,
        sortOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'b1000000-0000-4000-8000-000000000004',
        name: 'Event Companion',
        emoji: '🎉',
        description: 'Parties, events and social gatherings',
        color: '#F0EBFF',
        accentColor: '#6B4FE0',
        amount: 499,
        isActive: true,
        sortOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'b1000000-0000-4000-8000-000000000005',
        name: 'Fitness Partner',
        emoji: '💪',
        description: 'Gym, yoga and outdoor fitness company',
        color: '#E6F8F0',
        accentColor: '#0F9F6E',
        amount: 299,
        isActive: true,
        sortOrder: 5,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'b1000000-0000-4000-8000-000000000006',
        name: 'Movie Buddy',
        emoji: '🎬',
        description: 'Cinema and entertainment hangouts',
        color: '#FFEAF2',
        accentColor: '#C73B7A',
        amount: 299,
        isActive: true,
        sortOrder: 6,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'b1000000-0000-4000-8000-000000000007',
        name: 'Medical Support',
        emoji: '🩺',
        description: 'Clinic visit companionship',
        color: '#E8F4FF',
        accentColor: '#2563EB',
        amount: 599,
        isActive: true,
        sortOrder: 7,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'b1000000-0000-4000-8000-000000000008',
        name: 'Elder Care',
        emoji: '💙',
        description: 'Respectful elder company',
        color: '#E0F7F4',
        accentColor: '#0D9488',
        amount: 599,
        isActive: true,
        sortOrder: 8,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('companion_categories');
  },
};
