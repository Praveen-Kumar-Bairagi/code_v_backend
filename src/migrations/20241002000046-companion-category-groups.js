'use strict';

/** Main categories (groups) for companion sub-categories. */

const GROUPS = [
  {
    id: 'c1000000-0000-4000-8000-000000000001',
    name: 'Social & Lifestyle Companions',
    emoji: '🎉',
    description: 'Hangouts, outings, hobbies and social activities.',
    sortOrder: 1,
    members: [
      'Coffee Companion', 'Travel Buddy', 'Dinner Partner', 'Event Companion', 'Fitness Partner',
      'Movie Buddy', 'Reading Companion', 'Walking Companion', 'Shopping Companion', 'Hobby Companion',
      'Study Companion', 'Cultural Companion', 'City Explorer Companion', 'Concert Companion',
      'Pet Walking Companion',
    ],
  },
  {
    id: 'c1000000-0000-4000-8000-000000000002',
    name: 'Care & Daily Assistance Companions',
    emoji: '🤝',
    description: 'Non-medical companionship and everyday assistance.',
    sortOrder: 2,
    members: [
      'Senior Citizen Companion', 'Elder Care Companion', 'Daily Assistance Companion',
      'Medical Appointment Companion', 'Mobility Companion', 'Emotional Support Companion',
      'Digital Assistance Companion', 'Accessibility Companion', 'Medical Support', 'Elder Care',
    ],
  },
  {
    id: 'c1000000-0000-4000-8000-000000000003',
    name: 'Health & Wellness Companions',
    emoji: '🧘',
    description: 'Yoga, outdoor fitness and recovery-related visits.',
    sortOrder: 3,
    members: ['Yoga Companion', 'Outdoor Fitness Companion', 'Recovery Visit Companion'],
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('companion_category_groups', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: { type: Sequelize.STRING(120), allowNull: false },
      emoji: { type: Sequelize.STRING(16), allowNull: false, defaultValue: '✨' },
      description: { type: Sequelize.STRING(255), allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addColumn('companion_categories', 'groupId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'companion_category_groups', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('companion_categories', ['groupId']);

    const now = new Date();
    await queryInterface.bulkInsert(
      'companion_category_groups',
      GROUPS.map(({ members, ...group }) => ({ ...group, isActive: true, createdAt: now, updatedAt: now }))
    );

    for (const group of GROUPS) {
      await queryInterface.sequelize.query(
        'UPDATE companion_categories SET "groupId" = :groupId WHERE LOWER(TRIM(name)) IN (:names)',
        { replacements: { groupId: group.id, names: group.members.map((n) => n.toLowerCase()) } }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('companion_categories', ['groupId']);
    await queryInterface.removeColumn('companion_categories', 'groupId');
    await queryInterface.dropTable('companion_category_groups');
  },
};
