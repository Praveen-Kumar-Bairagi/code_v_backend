'use strict';

/**
 * Adds the Social & Lifestyle, Care & Daily Assistance and Health & Wellness
 * companion categories. Existing categories are kept; a category whose name
 * already exists is not inserted again.
 */

const CATEGORIES = [
  // A. Social & Lifestyle
  ['Coffee Companion', '☕', 'Coffee meetups and casual conversations.', '#FFF4E0', '#C47A00', 299],
  ['Travel Buddy', '🧳', 'Local sightseeing and travel companionship.', '#E8F4FF', '#1D6FD8', 499],
  ['Dinner Partner', '🍽️', 'Food outings and dinner companionship.', '#FFE8E4', '#D94B3A', 399],
  ['Event Companion', '🎉', 'Parties, events and social gatherings.', '#F0EBFF', '#6B4FE0', 499],
  ['Fitness Partner', '💪', 'Gym, yoga and outdoor fitness activities.', '#E6F8F0', '#0F9F6E', 299],
  ['Movie Buddy', '🎬', 'Cinema and entertainment hangouts.', '#FFEAF2', '#C73B7A', 299],
  ['Reading Companion', '📚', 'Reading sessions, libraries and book discussions.', '#FDF2E3', '#B45309', 299],
  ['Walking Companion', '🚶', 'Morning walks, evening walks and park visits.', '#E7F7EC', '#15803D', 249],
  ['Shopping Companion', '🛍️', 'Shopping malls, markets and shopping assistance.', '#FCE8F3', '#BE185D', 299],
  ['Hobby Companion', '🎨', 'Chess, painting, music, gardening and creative hobbies.', '#EEF2FF', '#4F46E5', 299],
  ['Study Companion', '📖', 'Study sessions, learning and library visits.', '#E0F2FE', '#0369A1', 249],
  ['Cultural Companion', '🏛️', 'Museums, exhibitions, art galleries and cultural activities.', '#F5EFE6', '#92400E', 399],
  ['City Explorer Companion', '🗺️', 'City sightseeing and exploring local attractions.', '#E6FFFA', '#0F766E', 399],
  ['Concert Companion', '🎵', 'Concerts, live music and entertainment events.', '#F3E8FF', '#7E22CE', 499],
  ['Pet Walking Companion', '🐕', 'Pet walks and outdoor activities.', '#FEF9C3', '#A16207', 249],

  // B. Care & Daily Assistance
  ['Senior Citizen Companion', '👵', 'Conversation, social visits and spending time with elderly people.', '#E0F7F4', '#0D9488', 399],
  ['Elder Care Companion', '💙', 'Non-medical companionship and basic daily assistance for elderly people.', '#E0F2FE', '#0284C7', 599],
  ['Daily Assistance Companion', '🛒', 'Grocery shopping, errands and everyday activities.', '#ECFDF5', '#047857', 399],
  ['Medical Appointment Companion', '🏥', 'Hospital visits, appointment coordination and non-medical assistance.', '#E8F4FF', '#2563EB', 599],
  ['Mobility Companion', '🦯', 'Assistance during walks and public-place visits.', '#F1F5F9', '#475569', 499],
  ['Emotional Support Companion', '🤝', 'Friendly conversations and social companionship. Not therapy.', '#FFF1F2', '#E11D48', 399],
  ['Digital Assistance Companion', '📱', 'Smartphone help, video calls and basic technology assistance.', '#EEF2FF', '#4338CA', 299],
  ['Accessibility Companion', '♿', 'Non-medical outing assistance for people with disabilities.', '#E0F2FE', '#1D4ED8', 499],

  // C. Health & Wellness
  ['Yoga Companion', '🧘', 'Yoga sessions and wellness activities.', '#F0FDF4', '#16A34A', 299],
  ['Outdoor Fitness Companion', '🚴', 'Cycling, jogging and outdoor exercise.', '#ECFEFF', '#0E7490', 299],
  ['Recovery Visit Companion', '🩹', 'Companionship during recovery-related appointments and visits.', '#FEF2F2', '#DC2626', 499],
];

/** Descriptions written by the original seed; only these are refreshed. */
const ORIGINAL_SEED_DESCRIPTIONS = {
  'Coffee Companion': 'Casual coffee meetups and conversations',
  'Travel Buddy': 'Local sightseeing and travel company',
  'Dinner Partner': 'Food outings and dinner companionship',
  'Event Companion': 'Parties, events and social gatherings',
  'Fitness Partner': 'Gym, yoga and outdoor fitness company',
  'Movie Buddy': 'Cinema and entertainment hangouts',
};

const idFor = (index) => `b2000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id, name, description, "sortOrder" FROM companion_categories'
    );
    const byName = new Map(existing.map((row) => [String(row.name).trim().toLowerCase(), row]));
    let nextSort = existing.reduce((max, row) => Math.max(max, Number(row.sortOrder) || 0), 0);

    const now = new Date();
    const rows = [];
    for (const [index, [name, emoji, description, color, accentColor, amount]] of CATEGORIES.entries()) {
      const current = byName.get(name.toLowerCase());
      if (current) {
        if (current.description === ORIGINAL_SEED_DESCRIPTIONS[name]) {
          await queryInterface.bulkUpdate('companion_categories', { description, updatedAt: now }, { id: current.id });
        }
        continue;
      }
      nextSort += 1;
      rows.push({
        id: idFor(index),
        name,
        emoji,
        description,
        color,
        accentColor,
        amount,
        isActive: true,
        sortOrder: nextSort,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (rows.length) await queryInterface.bulkInsert('companion_categories', rows);
  },

  async down(queryInterface) {
    const ids = CATEGORIES.map((_, index) => idFor(index));
    // Categories already used by bookings are kept so booking history stays intact
    await queryInterface.sequelize.query(
      `DELETE FROM companion_categories
        WHERE id IN (:ids)
          AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b."categoryId" = companion_categories.id)`,
      { replacements: { ids } }
    );
    for (const [name, description] of Object.entries(ORIGINAL_SEED_DESCRIPTIONS)) {
      const updated = CATEGORIES.find(([n]) => n === name)[2];
      await queryInterface.bulkUpdate('companion_categories', { description }, { name, description: updated });
    }
  },
};
