'use strict';

/**
 * Final companion category structure:
 *   Social & Lifestyle · Senior Care & Daily Assistance · Health & Wellness ·
 *   Travel, Events & Special Assistance
 * Adds Hospital Visit and Airport Assistance companions and refreshes descriptions.
 */

const SOCIAL = 'c1000000-0000-4000-8000-000000000001';
const CARE = 'c1000000-0000-4000-8000-000000000002';
const HEALTH = 'c1000000-0000-4000-8000-000000000003';
const TRAVEL = 'c1000000-0000-4000-8000-000000000004';

const GROUP_UPDATES = [
  { id: SOCIAL, name: 'Social & Lifestyle Companions', emoji: '🎉', sortOrder: 1,
    description: 'Hangouts, outings, hobbies and social activities.' },
  { id: CARE, name: 'Senior Care & Daily Assistance', emoji: '🤝', sortOrder: 2,
    description: 'Time with elders, errands and everyday non-medical assistance.' },
  { id: HEALTH, name: 'Health & Wellness Companions', emoji: '🧘', sortOrder: 3,
    description: 'Appointments, yoga, outdoor fitness and recovery visits.' },
  { id: TRAVEL, name: 'Travel, Events & Special Assistance', emoji: '✈️', sortOrder: 4,
    description: 'City exploring, airports, concerts and special assistance.' },
];

/** [name, groupId, sortOrder, description, new-row extras?] */
const CATEGORIES = [
  ['Reading Companion', SOCIAL, 7, 'Book reading, library visits, literature discussions.'],
  ['Walking Companion', SOCIAL, 8, 'Morning walks, evening walks, park visits.'],
  ['Hobby Companion', SOCIAL, 9, 'Chess, painting, music, gardening and creative activities.'],
  ['Shopping Companion', SOCIAL, 10, 'Shopping malls, markets and shopping assistance.'],
  ['Cultural Companion', SOCIAL, 11, 'Museum visits, exhibitions, art galleries and cultural events.'],
  ['Study Companion', SOCIAL, 12, 'Study sessions, library visits and learning together.'],

  ['Senior Citizen Companion', CARE, 1, 'Buzurgon ke saath time spend karna, baatein karna, walks aur social visits.'],
  ['Daily Assistance Companion', CARE, 2, 'Grocery shopping, bill payments, errands aur daily activities mein assistance.'],
  ['Mobility Companion', CARE, 3, 'Park visits, public places aur mobility assistance (appropriate training ke saath).'],
  ['Emotional Support Companion', CARE, 4, 'Conversation, social interaction aur loneliness kam karne ke liye companionship. Therapy nahi.'],
  ['Hospital Visit Companion', CARE, 5, 'Hospital appointments, registration desk, waiting aur travel assistance. Medical advice nahi.',
    { id: 'b2000000-0000-4000-8000-000000000101', emoji: '🏨', color: '#EFF6FF', accentColor: '#1E40AF', amount: 499 }],
  ['Digital Assistance Companion', CARE, 6, 'Smartphone, video calls, online forms aur basic technology use karne mein help.'],
  ['Elder Care Companion', CARE, 7, null],
  ['Medical Support', CARE, 8, null],
  ['Elder Care', CARE, 9, null],

  ['Medical Appointment Companion', HEALTH, 1, 'Doctor appointments ke liye saath jaana, hospital navigation aur appointment coordination.'],
  ['Yoga Companion', HEALTH, 2, 'Yoga sessions aur group wellness activities.'],
  ['Outdoor Fitness Companion', HEALTH, 3, 'Cycling, jogging, walking aur outdoor fitness activities.'],
  ['Recovery Visit Companion', HEALTH, 4, 'Physiotherapy appointments ya recovery-related visits mein companionship; treatment sirf qualified professionals karein.'],

  ['City Explorer Companion', TRAVEL, 1, 'City sightseeing, local attractions aur tourist places explore karna.'],
  ['Airport Assistance Companion', TRAVEL, 2, 'Airport navigation, check-in guidance aur waiting assistance. Airline services alag.',
    { id: 'b2000000-0000-4000-8000-000000000102', emoji: '🛫', color: '#E0F2FE', accentColor: '#0369A1', amount: 599 }],
  ['Concert Companion', TRAVEL, 3, 'Music concerts, live shows aur entertainment events.'],
  ['Accessibility Companion', TRAVEL, 4, 'Public places, museums, shopping aur outings mein persons with disabilities ko non-medical assistance.'],
  ['Pet Walking Companion', TRAVEL, 5, 'Pet walking, park visits aur pet owners ke saath outdoor activities.'],
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [groups] = await queryInterface.sequelize.query('SELECT id FROM companion_category_groups');
    const groupIds = new Set(groups.map((g) => g.id));
    for (const { id, ...fields } of GROUP_UPDATES) {
      if (groupIds.has(id)) {
        await queryInterface.bulkUpdate('companion_category_groups', { ...fields, updatedAt: now }, { id });
      } else {
        await queryInterface.bulkInsert('companion_category_groups', [
          { id, ...fields, isActive: true, createdAt: now, updatedAt: now },
        ]);
      }
    }

    const [existing] = await queryInterface.sequelize.query('SELECT id, name FROM companion_categories');
    const byName = new Map(existing.map((row) => [String(row.name).trim().toLowerCase(), row.id]));

    for (const [name, groupId, sortOrder, description, extras] of CATEGORIES) {
      const id = byName.get(name.toLowerCase());
      if (id) {
        const fields = { groupId, sortOrder, updatedAt: now };
        if (description) fields.description = description;
        await queryInterface.bulkUpdate('companion_categories', fields, { id });
      } else if (extras) {
        await queryInterface.bulkInsert('companion_categories', [
          { ...extras, name, description, groupId, sortOrder, isActive: true, createdAt: now, updatedAt: now },
        ]);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM companion_categories
        WHERE id IN (:ids)
          AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b."categoryId" = companion_categories.id)`,
      { replacements: { ids: CATEGORIES.filter((c) => c[4]).map((c) => c[4].id) } }
    );
    await queryInterface.sequelize.query(
      'UPDATE companion_categories SET "groupId" = :care WHERE "groupId" = :travel',
      { replacements: { care: CARE, travel: TRAVEL } }
    );
    await queryInterface.bulkDelete('companion_category_groups', { id: TRAVEL });
    await queryInterface.bulkUpdate(
      'companion_category_groups',
      { name: 'Care & Daily Assistance Companions' },
      { id: CARE }
    );
  },
};
