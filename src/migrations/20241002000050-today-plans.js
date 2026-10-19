'use strict';

/** Phase 1 "What's your plan today?" — plan types, user plans and interests. */

const PLAN_TYPES = [
  ['e1000000-0000-4000-8000-000000000001', 'Coffee', '☕', 'Grab a coffee and chat'],
  ['e1000000-0000-4000-8000-000000000002', 'Lunch', '🍱', 'Lunch together'],
  ['e1000000-0000-4000-8000-000000000003', 'Dinner', '🍽️', 'Dinner at a nice place'],
  ['e1000000-0000-4000-8000-000000000004', 'Movie', '🎬', 'Catch a movie'],
  ['e1000000-0000-4000-8000-000000000005', 'Walk', '🚶', 'Evening walk in a park'],
  ['e1000000-0000-4000-8000-000000000006', 'Shopping', '🛍️', 'Shopping or mall hangout'],
  ['e1000000-0000-4000-8000-000000000007', 'Gym / Workout', '🏋️', 'Workout partner'],
  ['e1000000-0000-4000-8000-000000000008', 'Explore the city', '🏙️', 'Visit new places in the city'],
  ['e1000000-0000-4000-8000-000000000009', 'Temple visit', '🛕', 'Visit a temple together'],
  ['e1000000-0000-4000-8000-000000000010', 'Sports / Games', '🏏', 'Play a game or sport'],
  ['e1000000-0000-4000-8000-000000000011', 'Long drive', '🚗', 'Go for a drive'],
  ['e1000000-0000-4000-8000-000000000012', 'Just talk', '💬', 'Meet up and talk'],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const timestamps = {
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    };

    await queryInterface.createTable('plan_types', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(80), allowNull: false },
      emoji: { type: Sequelize.STRING(16), allowNull: true },
      description: { type: Sequelize.STRING(200), allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });

    await queryInterface.createTable('user_plans', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      planTypeId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'plan_types', key: 'id' },
        onDelete: 'SET NULL',
      },
      planName: { type: Sequelize.STRING(80), allowNull: false },
      planEmoji: { type: Sequelize.STRING(16), allowNull: true },
      cityId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'cities', key: 'id' },
        onDelete: 'CASCADE',
      },
      cityAreaId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'city_areas', key: 'id' },
        onDelete: 'SET NULL',
      },
      areaName: { type: Sequelize.STRING(120), allowNull: true },
      latitude: { type: Sequelize.DOUBLE, allowNull: true },
      longitude: { type: Sequelize.DOUBLE, allowNull: true },
      scheduledAt: { type: Sequelize.DATE, allowNull: false },
      preferredGender: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'all' },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'active' },
      termsAcceptedAt: { type: Sequelize.DATE, allowNull: false },
      notifiedCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });
    await queryInterface.addIndex('user_plans', ['userId', 'status']);
    await queryInterface.addIndex('user_plans', ['cityId', 'status', 'scheduledAt']);

    await queryInterface.createTable('plan_interests', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      planId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'user_plans', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: { type: Sequelize.STRING(20), allowNull: false },
      conversationId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'conversations', key: 'id' },
        onDelete: 'SET NULL',
      },
      ...timestamps,
    });
    await queryInterface.addIndex('plan_interests', ['planId', 'userId'], { unique: true });
    await queryInterface.addIndex('plan_interests', ['userId']);

    const now = new Date();
    await queryInterface.bulkInsert(
      'plan_types',
      PLAN_TYPES.map(([id, name, emoji, description], i) => ({
        id,
        name,
        emoji,
        description,
        isActive: true,
        sortOrder: i + 1,
        createdAt: now,
        updatedAt: now,
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plan_interests');
    await queryInterface.dropTable('user_plans');
    await queryInterface.dropTable('plan_types');
  },
};
