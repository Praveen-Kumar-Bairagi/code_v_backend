'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'creatorHandle', {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'creatorExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex('users', ['creatorHandle'], {
      unique: true,
      name: 'users_creator_handle_unique',
    });
    await queryInterface.addColumn('creator_requests', 'durationMonths', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Existing creators get a handle (firstName+lastName, digit suffix on clash)
    const [creators] = await queryInterface.sequelize.query(
      'SELECT id, "firstName", "lastName" FROM users WHERE "isCreator" = true ORDER BY "createdAt" ASC'
    );
    const used = new Set();
    for (const u of creators) {
      let base = `${u.firstName || ''}${u.lastName || ''}`
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 24);
      if (base.length < 3) base = `${base}creator`.slice(0, 24);
      let handle = base;
      for (let n = 1; used.has(handle); n += 1) handle = `${base}${n}`;
      used.add(handle);
      await queryInterface.sequelize.query(
        'UPDATE users SET "creatorHandle" = :handle WHERE id = :id',
        { replacements: { handle, id: u.id } }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('creator_requests', 'durationMonths');
    await queryInterface.removeIndex('users', 'users_creator_handle_unique');
    await queryInterface.removeColumn('users', 'creatorExpiresAt');
    await queryInterface.removeColumn('users', 'creatorHandle');
  },
};
