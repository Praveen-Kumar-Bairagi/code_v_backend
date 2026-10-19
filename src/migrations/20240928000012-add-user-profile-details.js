'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'users';

    await queryInterface.addColumn(table, 'email', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'pincode', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'upiId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'aboutMe', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'education', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'profession', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'drinking', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'smoking', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'eating', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'relationshipStatus', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'lookingFor', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'interests', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.addColumn(table, 'photos', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.addColumn(table, 'selectedServiceIds', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.addColumn(table, 'availability', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });
    await queryInterface.addColumn(table, 'hideAge', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn(table, 'photoVerified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn(table, 'facebookVerified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn(table, 'kycVerified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn(table, 'kycFileName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    const table = 'users';
    const cols = [
      'email',
      'pincode',
      'upiId',
      'aboutMe',
      'education',
      'profession',
      'drinking',
      'smoking',
      'eating',
      'relationshipStatus',
      'lookingFor',
      'interests',
      'photos',
      'selectedServiceIds',
      'availability',
      'hideAge',
      'photoVerified',
      'facebookVerified',
      'kycVerified',
      'kycFileName',
    ];
    for (const col of cols) {
      await queryInterface.removeColumn(table, col);
    }
  },
};
