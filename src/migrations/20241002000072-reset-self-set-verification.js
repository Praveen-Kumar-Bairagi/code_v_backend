'use strict';

/**
 * Users could set photoVerified / facebookVerified from the app without any real check,
 * so every existing value is untrustworthy. Clear them; only a real selfie check or an
 * admin may set them from now on. Not reversible: the old values carried no meaning.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'UPDATE users SET "photoVerified" = false, "facebookVerified" = false WHERE "photoVerified" = true OR "facebookVerified" = true'
    );
  },

  async down() {},
};
